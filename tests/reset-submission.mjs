import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
let aiMode='good',calls=0;const words=['kopp','sykkel','stein','sko','lampe','hund'];
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',OPENAI_API_KEY:'fake-test-key'},cf:false,outboundService:async req=>{assert.equal(req.url,'https://api.openai.com/v1/chat/completions');assert.equal(req.headers.get('authorization'),'Bearer fake-test-key');calls++;const payload=await req.json();assert(payload.messages[0].content.includes('Vestvågøy'));assert.equal(payload.store,false);const dates=JSON.parse(payload.messages[1].content).dates;return new MFResponse(JSON.stringify({choices:[{message:{content:JSON.stringify({words:aiMode==='bad'?['to ord']:aiMode==='english'?['cup','bicycle','stone']:words.slice(0,dates.length)})}}]}),{status:aiMode==='quota'?429:200})}});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now(),headers={};for(const user of ['admin','early','late','pending']){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,?)').bind(user,user,'',user==='pending'?'pending':'approved',now-10000,now-5000,user==='admin'?1:0).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update(user).digest('hex'),user,now+86400000).run();headers[user]={cookie:'hunt_login='+user+(user==='admin'?'; hunt_admin=admin':''),'content-type':'application/json'};await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(user,user,'https://fcm.googleapis.com/'+user,'k','a',1,1).run();}
await db.prepare('INSERT INTO sessions(token,user,expires) VALUES (?,?,?)').bind('admin','admin',now+86400000).run();
await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('test-group','Test','admin',1)").run();
await db.prepare("INSERT INTO group_members(group_id,user,joined) SELECT 'test-group',id,1 FROM members").run();
async function req(user,body,url='/api/hunt'){const h={...headers[user]};let data;if(body instanceof FormData){const encoded=new Response(body);h['content-type']=encoded.headers.get('content-type');data=new Uint8Array(await encoded.arrayBuffer())}else data=body?JSON.stringify(body):undefined;const r=await mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:h,...(data?{body:data}:{})});return {status:r.status,data:await r.json()}}

await db.prepare("INSERT INTO seasons(id,name,start,daily) VALUES('album','Test',?,1)").bind(now-100000).run();
await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily,day) VALUES('hunt','album','kopp',?,?,3600000,?,1,'2026-01-01')").bind(now-100000,now+3600000,now-100000).run();
for(const user of ['admin','early']){
 await db.prepare("INSERT INTO starts(challenge,user,started) VALUES('hunt',?,?)").bind(user,now-60000).run();
 await db.prepare("INSERT INTO captures(token,user,challenge,expires,used,taken) VALUES(?,?,'hunt',?,0,?)").bind('camera-'+user,user,now+3600000,now-40000).run();
 await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES(?,'hunt',?,?,?,20000)").bind('photo-'+user,user,user+'.jpg',now).run();
}
await db.prepare("INSERT INTO comments(id,submission,user,body,created) VALUES('comment','photo-admin','early','test',?)").bind(now).run();
await db.prepare("INSERT INTO reactions(id,submission,user,emoji) VALUES('reaction','photo-admin','early','👍')").run();
assert.equal((await req('early',{action:'delete-own-photo',id:'photo-admin'})).status,404,'cannot delete another person photo');
assert.equal((await req('pending',{action:'delete-own-photo',id:'photo-admin'})).status,403);
const result=await req('admin',{action:'delete-own-photo',id:'photo-admin'});assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.resetUser,'admin');
for(const table of ['submissions','captures'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE user='admin'`).first()).n,0,table+' removed');
assert.equal((await db.prepare("SELECT started FROM starts WHERE user='admin'").first()).started,now-60000,'original start preserved');
assert.equal((await db.prepare("SELECT COUNT(*) n FROM submissions WHERE user='early'").first()).n,1,'other result preserved');
assert.equal((await db.prepare("SELECT COUNT(*) n FROM comments WHERE submission='photo-admin'").first()).n,0);
assert.equal((await db.prepare("SELECT COUNT(*) n FROM reactions WHERE submission='photo-admin'").first()).n,0);
assert.equal((await req('admin',{action:'start-daily',id:'hunt'})).status,200);
assert.equal((await db.prepare("SELECT started FROM starts WHERE user='admin'").first()).started,now-60000,'start endpoint cannot restart clock');
const cap=await req('admin',{action:'camera',id:'hunt'});assert.equal(cap.status,200);assert.equal(cap.data.started,now-60000);
const bytes=new Uint8Array(120);bytes.set([255,216,255]);
function form(token){const f=new FormData();f.set('challenge','hunt');f.set('token',token);f.set('taken',String(Date.now()));f.set('photo',new Blob([bytes],{type:'image/jpeg'}),'capture.jpg');return f}
assert.equal((await req('admin',form('camera-admin'))).status,400,'old lease cannot restore deleted result');
assert.equal((await req('admin',form(cap.data.token))).status,200,'new photo accepted');
assert((await db.prepare("SELECT elapsed FROM submissions WHERE user='admin'").first()).elapsed>=60000,'retake includes time since first reveal');
assert.equal((await req('early',{action:'delete-own-photo',id:'photo-early'})).status,200,'all approved users can delete own photo');
assert.equal((await db.prepare("SELECT started FROM starts WHERE user='early'").first()).started,now-60000);
await db.prepare("UPDATE challenges SET end=? WHERE id='hunt'").bind(now-1).run();
assert.equal((await req('early',{action:'camera',id:'hunt'})).status,400,'expired hunt cannot retake');
console.log('PASS: own-photo deletion for approved users, privacy, original start preserved, elapsed time grows on retake, old token rejected, related content cleanup and deadline enforcement.');
}finally{await mf.dispose()}
