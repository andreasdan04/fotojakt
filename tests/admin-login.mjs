import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false,bindings:{ADMIN_PIN:'9752',ADMIN_EMAIL:'owner@test.invalid'}});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now();for(const[id,status,isAdmin]of[['owner','approved',1],['alice','approved',0],['bob','approved',0],['outsider','approved',0],['pending','pending',0],['blocked','blocked',0]]){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,?,1,1,?)').bind(id,id,'',status,isAdmin).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(crypto.createHash('sha256').update(id).digest('hex'),id,now+86400000).run()}

await db.prepare("UPDATE members SET name='Andreas Danielsen',username='andreasdan04' WHERE id='owner'").run();await db.prepare("INSERT INTO settings(key,value) VALUES('owner','owner')").run();
const salt='test-salt',hash=crypto.pbkdf2Sync('123456',salt,100000,32,'sha256').toString('hex');await db.prepare("INSERT INTO local_accounts(user,login,salt,hash) VALUES('bob','bob',?,?)").bind(salt,hash).run();
async function auth(body){const r=await mf.dispatchFetch('https://test.invalid/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')||''}}
assert.equal((await auth({action:'login',name:'andreasdan04',pin:'1111'})).status,403,'wrong four-digit PIN rejected');
assert.equal((await auth({action:'login',name:'bob',pin:'9752'})).status,403,'admin PIN cannot log in as another user');
assert.equal((await auth({action:'login',name:'missing',pin:'9752'})).status,403,'admin PIN not accepted for arbitrary name');
assert.equal((await auth({action:'register',name:'New User',username:'newuser',pin:'9752',installed:true})).status,400,'four-digit registration rejected');
assert.equal((await auth({action:'login',name:'bob',pin:'12345'})).status,400);
let result=await auth({action:'login',name:'AndreasDan04',pin:'9752'});assert.equal(result.status,200,JSON.stringify(result));assert(result.cookie.includes('hunt_login='));assert(result.cookie.includes('hunt_admin='));assert(result.cookie.includes('HttpOnly'));assert(result.cookie.includes('Secure'));
const token=result.cookie.match(/hunt_login=([^;]+)/)[1],digest=crypto.createHash('sha256').update(token).digest('hex');assert.equal((await db.prepare('SELECT user FROM login_sessions WHERE token=?').bind(digest).first()).user,'owner','admin session is bound to owner');
assert.equal((await auth({action:'login',name:'Andreas Danielsen',pin:'9752'})).status,200,'admin display name also works');
result=await auth({action:'login',name:'bob',pin:'123456'});assert.equal(result.status,200);const memberToken=result.cookie.match(/hunt_login=([^;]+)/)[1];assert.equal((await db.prepare('SELECT user FROM login_sessions WHERE token=?').bind(crypto.createHash('sha256').update(memberToken).digest('hex')).first()).user,'bob');assert(result.cookie.includes('hunt_admin=;'),'normal login has no admin access');
assert.equal((await auth({action:'login',name:'bob',pin:'654321'})).status,403,'normal wrong PIN rejected');
await db.prepare('DELETE FROM attempts').run();for(let i=0;i<12;i++)assert.equal((await auth({action:'login',name:'unknown'+i,pin:'1111'})).status,403);assert.equal((await auth({action:'login',name:'andreasdan04',pin:'9752'})).status,429,'admin login is rate limited');
console.log('PASS: owner-only four-digit admin PIN, username/display-name login, secure sessions, six-digit members/registration and brute-force limits.');
}finally{await mf.dispose()}
