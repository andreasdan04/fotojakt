import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
try{
 const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
 const now=Date.now(),started=now-3600000;
 for(const user of ['owner','other']){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,\'approved\',1,1,0)').bind(user,user,'').run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(crypto.createHash('sha256').update(user).digest('hex'),user,now+86400000).run()}
 await db.prepare("INSERT INTO seasons(id,name,start) VALUES('s','Test',1)").run();
 // Push opt-out never gates opening a word, camera preparation or delivery.
 for(const user of ['owner','other']){const r=await mf.dispatchFetch('https://test.invalid/api/rules',{method:'POST',headers:{cookie:'hunt_login='+user,'content-type':'application/json'},body:JSON.stringify({rules_version:'2026-10-07.1',accepted:true})});assert.equal(r.status,200)}
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,0,'ordinary participants have never activated push');
 await db.prepare("INSERT INTO settings(key,value) VALUES('push_disabled:owner','1')").run();
 await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily) VALUES('optional-push','s','Testmotiv',?,?,3600000,1,1)").bind(now-1000,now+3600000).run();
 async function action(body,user='owner'){const r=await mf.dispatchFetch('https://test.invalid/api/hunt',{method:'POST',headers:{cookie:'hunt_login='+user,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
 assert.equal((await action({action:'start-daily',id:'optional-push'},'other')).status,200,'ordinary participant who never opted into push can open a word');
 assert.equal((await action({action:'start-daily',id:'optional-push'})).status,200,'word can be opened with push disabled');
 const opened=await db.prepare("SELECT started FROM starts WHERE user='owner' AND challenge='optional-push'").first();
 assert.equal((await action({action:'start-daily',id:'optional-push'})).data.started,opened.started,'reopening retains the original clock without push');
 const camera=await action({action:'camera',id:'optional-push'});assert.equal(camera.status,200,'camera can be prepared with push disabled');
 assert.equal((await action({action:'taken',token:camera.data.token})).status,200,'shutter time can be recorded with push disabled');
 const bytes=new Uint8Array(await readFile('tests/fixtures/metadata.jpg'));
 async function seed(id,end=now-1000,expires=now+80000000){await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily) VALUES(?,'s','kopp',?,?,3600000,1,1)").bind(id,started,end).run();await db.prepare("INSERT INTO starts(user,challenge,started) VALUES('owner',?,?)").bind(id,started).run();await db.prepare("INSERT INTO captures(token,user,challenge,issued,expires) VALUES(?,'owner',?,?,?)").bind(id,id,started+1000,expires).run()}
 async function upload(id,taken,user='owner'){const form=new FormData();form.set('challenge',id);form.set('token',id);form.set('taken',String(taken));form.set('photo',new Blob([bytes],{type:'image/jpeg'}),'capture.jpg');const encoded=new Response(form);const r=await mf.dispatchFetch('https://test.invalid/api/hunt',{method:'POST',headers:{cookie:'hunt_login='+user,'content-type':encoded.headers.get('content-type')},body:new Uint8Array(await encoded.arrayBuffer())});return {status:r.status,data:await r.json()}}
 await seed('offline');let r=await upload('offline',started+23583);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.elapsed,23583,'network delay never changes shutter time');
 r=await upload('offline',started+40000);assert.equal(r.status,200);assert.equal(r.data.elapsed,23583,'lost-response retry returns original confirmed result');assert.equal((await db.prepare('SELECT COUNT(*) n FROM submissions').first()).n,1);
 assert.equal((await upload('offline',started+23583,'other')).status,400,'token cannot be uploaded by another account');
 await seed('late');assert.equal((await upload('late',now)).status,400,'photo after deadline rejected');assert.equal((await upload('late',started)).status,400,'photo before lease issuance rejected');assert.equal((await upload('late',now+5000)).status,400,'future timestamp rejected');
 await seed('expired',now-90000000,now-1);assert.equal((await upload('expired',started+23583)).status,400,'grace is bounded');
 await seed('ended-season');await db.prepare("UPDATE seasons SET end=? WHERE id='s'").bind(now-500).run();assert.equal((await upload('ended-season',started+23583)).status,400,'admin-closed season stays closed');
 console.log('PASS: offline upload retains 23.583 seconds after hunt closes; idempotent lost-response retries; account isolation, lease/deadline/future/expiry checks and season closure.');
}finally{await mf.dispose()}
