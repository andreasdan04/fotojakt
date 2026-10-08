import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
let aiMode='good',calls=0;const words=['kopp','sykkel','stein','sko','lampe','hund'];
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',OPENAI_API_KEY:'fake-test-key'},cf:false,outboundService:async req=>{assert.equal(req.url,'https://api.openai.com/v1/chat/completions');assert.equal(req.headers.get('authorization'),'Bearer fake-test-key');calls++;const payload=await req.json();assert(payload.messages[0].content.includes('Vestvågøy'));assert.equal(payload.store,false);const dates=JSON.parse(payload.messages[1].content).dates;return new MFResponse(JSON.stringify({choices:[{message:{content:JSON.stringify({words:aiMode==='bad'?['to ord']:aiMode==='english'?['cup','bicycle','stone']:words.slice(0,dates.length)})}}]}),{status:aiMode==='quota'?429:200})}});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
// Isolate normal-hunt scheduling from randomized weekly lightning hunts.
const monday=new Date(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(Date.now())+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
for(let i=0;i<5;i++){const week=new Date(monday.getTime()+i*7*86400000).toISOString().slice(0,10);await db.prepare('INSERT INTO game_hunts(challenge,week,lightning) VALUES (?,?,1)').bind('test-lightning:'+week,week).run();}
const now=Date.now(),headers={};for(const user of ['admin','early','late','pending']){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,?)').bind(user,user,'',user==='pending'?'pending':'approved',now-10000,now-5000,user==='admin'?1:0).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update(user).digest('hex'),user,now+86400000).run();headers[user]={cookie:'hunt_login='+user+(user==='admin'?'; hunt_admin=admin':''),'content-type':'application/json'};await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(user,user,'https://fcm.googleapis.com/'+user,'k','a',1,1).run();}
await db.prepare('INSERT INTO sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update('admin').digest('hex'),'admin',now+86400000).run();
await db.prepare("INSERT INTO settings(key,value) VALUES('owner','admin'),('admin-agreement:admin',?)").bind(JSON.stringify({version:'2026-10-07.1',accepted:now})).run();
await db.prepare("INSERT INTO rules_acceptances(user_id,rules_version,accepted_at) SELECT id,'2026-10-07.1',1 FROM members").run();
async function req(user,body,url='/api/hunt'){const h={...headers[user]};let data;if(body instanceof FormData){const encoded=new Response(body);h['content-type']=encoded.headers.get('content-type');data=new Uint8Array(await encoded.arrayBuffer())}else data=body?JSON.stringify(body):undefined;const r=await mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:h,...(data?{body:data}:{})});return {status:r.status,data:await r.json()}}

const tomorrow=new Date(now+86400000).toISOString().slice(0,10),last=new Date(now+31*86400000).toISOString().slice(0,10);
let r=await req('admin',{action:'album',name:'Two per day',first:tomorrow,last});assert.equal(r.status,200,JSON.stringify(r));const album=r.data.id;
let rows=(await db.prepare('SELECT * FROM challenges WHERE season=? ORDER BY start').bind(album).all()).results;
assert.equal(rows.length,62);const hour=n=>new Intl.DateTimeFormat('en',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(n);
for(let i=0;i<62;i+=2){assert.equal(rows[i].day,rows[i+1].day);assert.equal(rows[i].slot,1);assert.equal(rows[i+1].slot,2);assert.equal(hour(rows[i].start),'06');assert.equal(hour(rows[i].end),'17');assert.equal(hour(rows[i+1].start),'14');assert.equal(rows[i].end-rows[i+1].start,3*3600000);assert.equal(hour(rows[i+1].end),'00');assert.notEqual(rows[i].title,rows[i+1].title);}
// Previously scheduled 07:00 mornings move once to 06:00, preserving words and deadlines.
const original=rows[2];
await db.prepare('UPDATE challenges SET start=start+3600000,duration=duration-3600000 WHERE id=?').bind(original.id).run();
await req('early');await req('early');
const migrated=await db.prepare('SELECT * FROM challenges WHERE id=?').bind(original.id).first();
assert.equal(migrated.start,original.start);assert.equal(migrated.end,original.end);assert.equal(migrated.title,original.title);assert.equal(migrated.duration,original.end-original.start);
// A scheduled future album also follows its first migrated morning.
await db.prepare('UPDATE seasons SET start=start+3600000 WHERE id=?').bind(album).run();
await db.prepare('UPDATE challenges SET start=start+3600000,duration=duration-3600000 WHERE id=?').bind(rows[0].id).run();
await req('early');assert.equal((await db.prepare('SELECT start FROM seasons WHERE id=?').bind(album).first()).start,rows[0].start);
assert.equal((await req('early',{action:'refresh-words'})).status,403);
assert.equal((await req('early',{action:'start-daily',id:rows[1].id})).status,400,'future afternoon is hidden');
await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-10000,now+3600000,rows[0].id).run();
await req('early',{action:'start-daily',id:rows[0].id});
r=await req('admin',{action:'refresh-words'});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.count,61);
let updated=(await db.prepare('SELECT * FROM challenges WHERE season=? ORDER BY start').bind(album).all()).results;
assert.equal(updated[0].title,rows[0].title,'active word preserved');assert(updated.slice(1).every(x=>x.title!==rows.find(y=>y.id===x.id).title));
aiMode='quota';r=await req('admin',{action:'refresh-words'});assert.equal(r.status,502);assert.deepEqual((await db.prepare('SELECT id,title FROM challenges ORDER BY id').all()).results,updated.map(({id,title})=>({id,title})).sort((a,b)=>a.id.localeCompare(b.id)));aiMode='good';
await req('admin',{action:'delete-season',id:album});
// Legacy future full days split once, active full days keep their original deadline.
await db.prepare("INSERT INTO seasons(id,name,start,daily) VALUES('old','Old',?,1)").bind(now-10000).run();
await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily,day) VALUES('active','old','kopp',?,?,50000,?,1,'2026-01-01')").bind(now-10000,now+100000,now-10000).run();
await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily,day) VALUES('future','old','sko',?,?,61200000,?,1,?)").bind(rows[2].start,rows[3].end,now,rows[2].day).run();
await req('early');await req('early');
const future=(await db.prepare("SELECT * FROM challenges WHERE day=? ORDER BY start").bind(rows[2].day).all()).results;assert.equal(future.length,2);assert.equal(future[0].slot,1);assert.equal(future[1].slot,2);assert.equal(future[0].end-future[1].start,3*3600000);
assert.equal((await db.prepare("SELECT end FROM challenges WHERE id='active'").first()).end,now+100000);
console.log('PASS: 31 days / 62 slots, boundaries, hidden future words, admin-only regeneration, active preservation, all-future replacement, AI failure atomicity and idempotent legacy upgrade.');
}finally{await mf.dispose()}
