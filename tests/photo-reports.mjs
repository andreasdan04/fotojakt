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
await db.prepare("INSERT INTO challenges(id,season,title,details,start,end,duration,created,daily,day) VALUES('hunt','album','kopp','',?,?,100000,?,1,'2026-01-01')").bind(now-50000,now+50000,now-50000).run();
async function photo(id,user,challenge='hunt'){await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES(?,?,?,?,?,1000)').bind(id,challenge,user,id+'.jpg',now).run()}
await photo('p','early');
assert.equal((await req('late',{action:'report-photo',id:'p',reason:'Gammelt bilde'})).status,403,'hidden photos cannot be reported');
assert.equal((await req('early',{action:'report-photo',id:'p',reason:'Eget bilde'})).status,403);
assert.equal((await req('pending',{action:'report-photo',id:'p',reason:'test'})).status,403);
await photo('a','admin');
assert.equal((await req('admin',{action:'report-photo',id:'p',reason:'Bildet viser en skjerm'})).status,200);
assert.equal((await req('admin',{action:'report-photo',id:'p',reason:'Duplikat'})).status,400);
let report=(await req('admin')).data.reports.find(r=>r.submission==='p');assert.equal(report.electorate,2);assert.equal(report.threshold,2);assert.equal(report.invalidVotes,0,'report is not a vote');
assert.equal((await req('late')).data.reports.length,0,'report must not reveal hidden photo');
assert.equal((await req('late',undefined,'/api/hunt?profile=early')).data.reports.length,0);
assert.equal((await req('early',{action:'vote-photo',id:'p',choice:'valid'})).status,403,'owner cannot vote');
assert.equal((await req('late',{action:'vote-photo',id:'p',choice:'invalid'})).status,403,'hidden photo cannot be voted on');
assert.equal((await req('admin',{action:'vote-photo',id:'p',choice:'invalid'})).status,200);
assert.equal((await req('admin',{action:'vote-photo',id:'p',choice:'valid'})).status,400,'ballot immutable');
assert.equal((await db.prepare("SELECT valid FROM submissions WHERE id='p'").first()).valid,1,'one vote cannot disqualify');
await photo('l','late');
assert.equal((await req('late',{action:'vote-photo',id:'p',choice:'invalid'})).status,200);
assert.equal((await db.prepare("SELECT valid FROM submissions WHERE id='p'").first()).valid,0);
assert.equal((await req('early')).data.reports.find(r=>r.submission==='p').status,'invalid');
assert.equal((await req('admin',{action:'result',id:'p',seconds:1,valid:true,note:'Kontrollert av admin'})).status,200);
assert.equal((await req('early')).data.reports.find(r=>r.submission==='p').status,'admin');
assert.equal((await db.prepare("SELECT valid FROM submissions WHERE id='p'").first()).valid,1,'later settlement cannot override admin');
assert.equal((await req('early',{action:'report-photo',id:'l',reason:'Passer ikke ordet'})).status,200);
assert.equal((await req('early',{action:'vote-photo',id:'l',choice:'invalid'})).status,200);
await db.prepare("UPDATE photo_reports SET deadline=? WHERE submission='l'").bind(now-1).run();
assert.equal((await req('admin',{action:'vote-photo',id:'l',choice:'invalid'})).status,400,'deadline enforced');
assert.equal((await req('late')).data.reports.find(r=>r.submission==='l').status,'valid','no majority at timeout retains valid photo');
assert.equal((await db.prepare("SELECT valid FROM submissions WHERE id='l'").first()).valid,1);
assert.equal((await req('early',{action:'report-photo',id:'a',reason:'Feil motiv'})).status,200);
assert.equal((await req('early',{action:'vote-photo',id:'a',choice:'valid'})).status,200);
assert.equal((await req('late',{action:'vote-photo',id:'a',choice:'valid'})).status,200);
assert.equal((await req('admin')).data.reports.find(r=>r.submission==='a').status,'valid');
await req('admin',{action:'delete-season',id:'album'});
for(const table of ['photo_reports','photo_votes','photo_voters'])assert.equal((await db.prepare(`SELECT COUNT(*) n FROM ${table}`).first()).n,0);
console.log('PASS: report privacy, ownership, eligibility, duplicate reports/ballots, majority, timeout, admin override and deletion.');
}finally{await mf.dispose()}
