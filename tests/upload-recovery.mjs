import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
let aiMode='good',calls=0;const words=['kopp','sykkel','stein','sko','lampe','hund'];
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',OPENAI_API_KEY:'fake-test-key'},cf:false,outboundService:async req=>{assert.equal(req.url,'https://api.openai.com/v1/chat/completions');assert.equal(req.headers.get('authorization'),'Bearer fake-test-key');calls++;const payload=await req.json();assert(payload.messages[0].content.includes('Vestvågøy'));assert.equal(payload.store,false);const dates=JSON.parse(payload.messages[1].content).dates;return new MFResponse(JSON.stringify({choices:[{message:{content:JSON.stringify({words:aiMode==='bad'?['to ord']:aiMode==='english'?['cup','bicycle','stone']:words.slice(0,dates.length)})}}]}),{status:aiMode==='quota'?429:200})}});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now(),headers={};for(const user of ['admin','early','late','pending']){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,?)').bind(user,user,'',user==='pending'?'pending':'approved',now-10000,now-5000,user==='admin'?1:0).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update(user).digest('hex'),user,now+86400000).run();headers[user]={cookie:'hunt_login='+user+(user==='admin'?'; hunt_admin=admin':''),'content-type':'application/json'};await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(user,user,'https://fcm.googleapis.com/'+user,'k','a',1,1).run();}
await db.prepare('INSERT INTO sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update('admin').digest('hex'),'admin',now+86400000).run();
await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('test-group','Test','admin',1)").run();
await db.prepare("INSERT INTO group_members(group_id,user,joined) SELECT 'test-group',id,1 FROM members").run();
await seedStaffAcceptance(db,'admin',now);await db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('owner',?)").bind('admin').run();
await db.prepare("INSERT OR IGNORE INTO rules_acceptances(user_id,rules_version,accepted_at) SELECT id,'2026-10-07.1',1 FROM members").run();
async function req(user,body,url='/api/hunt'){const h={...headers[user]};let data;if(body instanceof FormData){const encoded=new Response(body);h['content-type']=encoded.headers.get('content-type');data=new Uint8Array(await encoded.arrayBuffer())}else data=body?JSON.stringify(body):undefined;const r=await mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:h,...(data?{body:data}:{})});return {status:r.status,data:await r.json()}}

await db.prepare("INSERT INTO seasons(id,name,start,daily) VALUES('album','Test',?,1)").bind(now-100000).run();
await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily,day) VALUES('hunt','album','kopp',?,?,3600000,?,1,'2026-01-01')").bind(now-100000,now+3600000,now-100000).run();
await db.prepare("INSERT INTO starts(challenge,user,started) VALUES('hunt','early',?)").bind(now-60000).run();
await db.prepare("INSERT INTO captures(token,user,challenge,expires,used,taken) VALUES('camera','early','hunt',?,0,?)").bind(now+3600000,now-40000).run();
const bytes=new Uint8Array(await readFile('tests/fixtures/metadata.jpg'));
const form=new FormData();form.set('challenge','hunt');form.set('token','camera');form.set('photo',new Blob([bytes],{type:'image/jpeg'}),'capture.jpg');
let r=await req('early',form);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.elapsed,20000);
r=await req('early',form);assert.equal(r.status,200);assert.equal(r.data.elapsed,20000);
assert.equal((await db.prepare("SELECT COUNT(*) n FROM submissions WHERE user='early'").first()).n,1);
// Simulate an interrupted response after insert but before the used flag is set.
await db.prepare("UPDATE captures SET used=0 WHERE token='camera'").run();
assert.equal((await req('early',form)).status,200);
assert.equal((await req('late',form)).status,400,'token belongs only to the original photographer');
// A retry after the deadline still confirms the already delivered result.
await db.prepare("UPDATE challenges SET end=? WHERE id='hunt'").bind(now-1).run();
assert.equal((await req('early',form)).status,200);
const sid='0f62bc74-1ad2-4ff7-b432-d63e3584beb9';
await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES(?,?,?,?,?,57243)').bind(sid,'1375c662-5683-47bf-98f0-cf73c453ce7b','nFFZFJUgMaTF8grC0aiPtrhtQzxyKhx0MvNAmynPttrhtJJgUD8Vxb','existing.jpg',1791090910483).run();
await req('early');assert.equal((await db.prepare('SELECT elapsed FROM submissions WHERE id=?').bind(sid).first()).elapsed,23583);
await db.prepare('UPDATE submissions SET elapsed=24000 WHERE id=?').bind(sid).run();await req('early');
assert.equal((await db.prepare('SELECT elapsed FROM submissions WHERE id=?').bind(sid).first()).elapsed,24000,'later correction is preserved');
console.log('PASS: upload retry, exact capture time, one submission, lost-response recovery, ownership, deadline confirmation and one-time result repair.');
}finally{await mf.dispose()}
