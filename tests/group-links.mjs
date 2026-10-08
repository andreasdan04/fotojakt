import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now();for(const[id,status,isAdmin]of[['owner','approved',1],['alice','approved',0],['bob','approved',0],['outsider','approved',0],['pending','pending',0],['blocked','blocked',0]]){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,?,1,1,?)').bind(id,id,'',status,isAdmin).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(crypto.createHash('sha256').update(id).digest('hex'),id,now+86400000).run()}
await db.prepare("INSERT INTO sessions(token,user,expires) VALUES('64f46a7526a186d2346552453ae478ca51244674f5b21ba150bd483b39f7c812','owner',?)").bind(now+86400000).run();await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('group','Private Group','alice',1)").run();for(const[id,role]of[['alice','member'],['bob','member']])await db.prepare("INSERT INTO group_members(group_id,user,role,joined) VALUES('group',?,?,1)").bind(id,role).run();
async function req(user,body,origin){const r=await mf.dispatchFetch('https://test.invalid/api/social',{method:body?'POST':'GET',headers:{...(user?{cookie:'hunt_login='+user}:{}),...(body?{'content-type':'application/json'}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
const link=(action,group='group')=>({action,group});
assert.equal((await req(null,link('create-group-link'))).status,401);
for(const user of ['pending','blocked','bob','outsider','owner'])assert.notEqual((await req(user,link('create-group-link'))).status,200,'only actual group managers share');
let created=await req('alice',link('create-group-link'));assert.equal(created.status,200);let token=created.data.token;assert.match(token,/^[a-f0-9]{64}$/);
assert.equal((await req('alice',link('create-group-link'))).data.token,token,'share/copy use same active link');
assert.equal((await req('alice')).data.groups[0].linkToken,token);assert.equal((await req('bob')).data.groups[0].linkToken,null,'ordinary member cannot read token');
assert.equal((await req('outsider')).data.groups.length,0);
assert.equal((await req(null,{action:'join-group-link',token})).status,401);
for(const user of ['pending','blocked'])assert.equal((await req(user,{action:'join-group-link',token})).status,403);
assert.equal((await req('outsider',{action:'join-group-link',token},'https://evil.invalid')).status,403);
assert.equal((await req('outsider',{action:'join-group-link',token:'group'})).status,404);
assert.equal((await req('outsider',{action:'join-group-link',token:'a'.repeat(64)})).status,404);
let joined=await req('outsider',{action:'join-group-link',token});assert.equal(joined.status,200);assert.equal(joined.data.group,'group');assert.equal((await req('outsider',{action:'join-group-link',token})).status,200);
assert.equal((await db.prepare("SELECT COUNT(*) n FROM group_members WHERE group_id='group' AND user='outsider'").first()).n,1);
assert.equal((await db.prepare("SELECT role FROM group_members WHERE group_id='group' AND user='outsider'").first()).role,'member');
assert.equal((await req('outsider')).data.groups[0].linkToken,null);
assert.equal((await req('bob',link('revoke-group-link'))).status,403);
assert.equal((await req('alice',link('revoke-group-link'))).status,200);
assert.equal((await req('owner',{action:'join-group-link',token})).status,404,'revocation prevents future joins');
assert(await db.prepare("SELECT user FROM group_members WHERE user='outsider' AND group_id='group'").first(),'revocation keeps existing membership');
const next=(await req('alice',link('create-group-link'))).data.token;assert.notEqual(next,token);token=next;
await db.prepare("UPDATE group_members SET role='admin' WHERE group_id='group' AND user='bob'").run();await req('bob',link('revoke-group-link'));token=(await req('bob',link('create-group-link'))).data.token;
await db.prepare("UPDATE group_members SET role='member' WHERE group_id='group' AND user='bob'").run();
assert.equal((await req('owner',{action:'join-group-link',token})).status,404,'demoted creator cannot grant access');
assert.equal((await req('alice')).data.groups[0].linkToken,null);
token=(await req('alice',link('create-group-link'))).data.token;
await db.prepare("UPDATE members SET status='blocked' WHERE id='alice'").run();assert.equal((await req('owner',{action:'join-group-link',token})).status,404,'blocked issuer cannot grant access');
await db.prepare("UPDATE members SET status='approved' WHERE id='alice'").run();await db.prepare("DELETE FROM groups WHERE id='group'").run();assert.equal((await req('owner',{action:'join-group-link',token})).status,404,'deleted group cannot be recreated by link');
console.log('PASS: manager-only sharing, secret links, approved login required, automatic membership, idempotency, origin, role boundaries, revocation and deleted/blocked/demoted issuer protection.');
}finally{await mf.dispose()}
