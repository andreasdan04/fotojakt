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


assert.equal((await req(null,undefined,'/api/usage')).status,401);
assert.equal((await req('early',undefined,'/api/usage')).status,403);
assert.equal((await req('pending',{event:'presence'},'/api/usage')).status,403);
assert.equal((await req('early',{event:'not-allowed'},'/api/usage')).status,400);
assert.equal((await req('early',{event:'seconds'},'/api/usage')).status,400);
assert.equal((await req('early',{event:'presence',user:'late'},'/api/usage')).status,200);
assert.equal((await req('early',{event:'presence'},'/api/usage')).status,200);
assert.equal((await db.prepare("SELECT count FROM usage_daily WHERE user='early' AND event='visit'").first()).count,1,'refresh and multiple tabs do not add visits');
assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_activity WHERE user='late'").first()).n,0,'identity cannot be spoofed');
await db.prepare("UPDATE usage_activity SET last_seen=? WHERE user='early'").bind(Date.now()-30000).run();
assert.equal((await req('early',{event:'presence'},'/api/usage')).status,200);
const seconds=(await db.prepare("SELECT count FROM usage_daily WHERE user='early' AND event='seconds'").first()).count;
assert(seconds>=29&&seconds<=31,'active duration bounded by pulse interval');
await db.prepare("UPDATE usage_activity SET last_seen=? WHERE user='early'").bind(Date.now()-1801000).run();
await req('early',{event:'presence'},'/api/usage');
assert.equal((await db.prepare("SELECT count FROM usage_daily WHERE user='early' AND event='visit'").first()).count,2,'return after inactivity adds visit');
await req('early',{event:'camera'},'/api/usage');await req('early',{event:'camera'},'/api/usage');
await req('admin',{event:'presence'},'/api/usage');
let r=await req('admin',undefined,'/api/usage?days=7');
assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.totals.visits,2);assert.equal(r.data.totals.users,1);
assert.equal(r.data.features.find(f=>f.event==='camera').count,2);
assert.equal(r.data.features.find(f=>f.event==='camera').users,1);
assert.equal(r.data.users.find(u=>u.id==='early').visits,2);
assert.equal(r.data.users.some(u=>u.id==='admin'),false,'admin excluded by default');
r=await req('admin',undefined,'/api/usage?days=7&admin=1');assert.equal(r.data.totals.visits,3);
assert.equal((await req('admin',undefined,'/api/usage?days=900')).status,400);
const forged=await mf.dispatchFetch('https://test.invalid/api/usage',{method:'POST',headers:{...headers.early,origin:'https://evil.invalid'},body:JSON.stringify({event:'presence'})});assert.equal(forged.status,403);
await db.prepare("INSERT INTO usage_daily(day,user,event,count) VALUES('2001-01-01','early','camera',500)").run();
await db.prepare("DELETE FROM settings WHERE key='usage-cleanup'").run();
await req('early',{event:'presence'},'/api/usage');
assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_daily WHERE day='2001-01-01'").first()).n,0,'old aggregates pruned');
await req('admin',{action:'delete-member',id:'early'});
assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_daily WHERE user='early'").first()).n,0,'account deletion removes usage');
assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_activity WHERE user='early'").first()).n,0);
console.log('PASS: admin-only stats, member authentication, validated events, spoof protection, session deduplication, active time, feature counts, admin filter, CSRF, retention and account deletion.');
}finally{await mf.dispose()}

