import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
let aiMode='good',calls=0;const words=['kopp','sykkel','stein','sko','lampe','hund'];
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',OPENAI_API_KEY:'fake-test-key'},cf:false,outboundService:async req=>{assert.equal(req.url,'https://api.openai.com/v1/chat/completions');assert.equal(req.headers.get('authorization'),'Bearer fake-test-key');calls++;const payload=await req.json();assert(payload.messages[0].content.includes('Vestvågøy'));assert.equal(payload.store,false);const dates=JSON.parse(payload.messages[1].content).dates;return new MFResponse(JSON.stringify({choices:[{message:{content:JSON.stringify({words:aiMode==='bad'?['to ord']:aiMode==='english'?['cup','bicycle','stone']:words.slice(0,dates.length)})}}]}),{status:aiMode==='quota'?429:200})}});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now(),headers={};for(const user of ['admin','early','late','pending']){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,?)').bind(user,user,'',user==='pending'?'pending':'approved',now-10000,now-5000,user==='admin'?1:0).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update(user).digest('hex'),user,now+86400000).run();headers[user]={cookie:'hunt_login='+user+(user==='admin'?'; hunt_admin=admin':''),'content-type':'application/json'};await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(user,user,'https://fcm.googleapis.com/'+user,'k','a',1,1).run();}
await db.prepare('INSERT INTO sessions(token,user,expires) VALUES (?,?,?)').bind('admin','admin',now+86400000).run();
async function req(user,body,url='/api/hunt'){const h={...headers[user]};let data;if(body instanceof FormData){const encoded=new Response(body);h['content-type']=encoded.headers.get('content-type');data=new Uint8Array(await encoded.arrayBuffer())}else data=body?JSON.stringify(body):undefined;const r=await mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:h,...(data?{body:data}:{})});return {status:r.status,data:await r.json()}}


await db.prepare("INSERT INTO seasons(id,name,start) VALUES('a','Test',1)").run();
await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created) VALUES('c','a','Test',1,9999999999999,10000,1)").run();
await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES('p','c','early','photos/p.jpg',1,100)").run();
await db.prepare("INSERT INTO avatars(user,key,updated) VALUES('early','avatars/p.jpg',1)").run();
const bucket=await mf.getR2Bucket('BUCKET');await bucket.put('photos/p.jpg','test');await bucket.put('avatars/p.jpg','test');
await db.prepare("INSERT INTO comments(id,submission,user,body,created) VALUES('x','p','late','Comment',1)").run();
assert.equal((await req('late',{action:'delete-member',id:'early'})).status,403);
assert.equal((await req('admin',{action:'delete-member',id:'admin'})).status,403);
assert.equal((await req('admin',{action:'delete-member',id:'early'})).status,200);
for(const table of ['members','login_sessions','push_subscriptions','avatars','submissions'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE ${table==='members'?'id':'user'}='early'`).first()).n,0);
assert.equal(await bucket.get('photos/p.jpg'),null);assert.equal(await bucket.get('avatars/p.jpg'),null);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM comments').first()).n,0);
assert.equal((await req('early')).data.user,null);
assert.equal((await req('admin',{action:'delete-member',id:'pending'})).status,200);
assert.equal((await req('admin',{action:'delete-member',id:'early'})).status,404);
assert(await db.prepare("SELECT id FROM members WHERE id='late'").first());
assert(await db.prepare("SELECT id FROM challenges WHERE id='c'").first());
console.log('PASS: admin-only member deletion, admin protection, pending deletion, sessions revoked, media removed, related data cleaned, other members preserved.');
}finally{await mf.dispose()}
