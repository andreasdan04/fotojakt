import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare'),webpush=require('web-push'),ece=createRequire(require.resolve('web-push'))('http_ece');
const vapid=webpush.generateVAPIDKeys(),receiver=crypto.createECDH('prime256v1');receiver.generateKeys();const auth=crypto.randomBytes(16).toString('base64url'),packets=[];let responseStatus=201;
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',ADMIN_EMAIL:'owner@test.invalid',VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,PUSH_SCHEDULER_SECRET:'test-secret'},cf:false,outboundService:async req=>{
assert(req.url.startsWith('https://fcm.googleapis.com/'));assert.equal(req.headers.get('content-encoding'),'aes128gcm');assert(req.headers.get('authorization').startsWith('vapid t='));
const bytes=Buffer.from(await req.arrayBuffer());const payload=JSON.parse(ece.decrypt(bytes,{version:'aes128gcm',privateKey:receiver,authSecret:auth}).toString());packets.push(payload);return new MFResponse('',{status:responseStatus});}});
try{const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
// Isolate normal-hunt scheduling from randomized weekly lightning hunts.
const monday=new Date(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(Date.now())+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
for(let i=0;i<5;i++){const week=new Date(monday.getTime()+i*7*86400000).toISOString().slice(0,10);await db.prepare('INSERT INTO game_hunts(challenge,week,lightning) VALUES (?,?,1)').bind('test-lightning:'+week,week).run();}
const now=Date.now();await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,1)').bind('owner','Owner','owner@test.invalid','approved',now-9000000,now-9000000).run();await db.prepare('INSERT INTO seasons(id,name,start) VALUES (?,?,?)').bind('season','Test',now-9000000).run();
await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update('test-session').digest('hex'),'owner',now+3600000).run();
const headers={cookie:'hunt_login=test-session','content-type':'application/json'};
async function post(body){const r=await mf.dispatchFetch('https://test.invalid/api/push',{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
async function tick(secret='test-secret'){const r=await mf.dispatchFetch('https://test.invalid/api/push/tick',{method:'POST',headers:{'x-photo-hunt-scheduler-key':secret}});return {status:r.status,data:await r.json()}}
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/test-device',keys:{p256dh:receiver.getPublicKey().toString('base64url'),auth}};
assert.equal((await tick('wrong')).status,401);assert.equal((await post({action:'subscribe',installed:true,subscription:{...subscription,endpoint:'https://localhost/private'}})).status,400);assert.equal((await post({action:'subscribe',subscription})).status,400);assert.equal((await post({action:'subscribe',installed:true,subscription})).status,200);
await db.prepare("UPDATE members SET status='pending' WHERE id='owner'").run();assert.equal((await post({action:'subscribe',installed:true,subscription})).status,200);assert.equal((await(await mf.dispatchFetch('https://test.invalid/api/hunt',{headers})).json()).challenges,undefined);assert.equal((await tick()).data.sent,0);await db.prepare("UPDATE members SET status='approved' WHERE id='owner'").run();
await db.prepare('UPDATE push_subscriptions SET created=?').bind(now-8000000).run();
await db.prepare('INSERT INTO challenges(id,season,title,details,start,end,duration,created) VALUES (?,?,?,?,?,?,?,?)').bind('c','season','Hemmelig motiv','Hemmelig detalj',now+3600000,now+7200000,3600000,now-1000).run();
let r=await tick();assert.equal(r.data.sent,1,JSON.stringify(r));assert.equal(packets[0].kind,'ready');assert(!packets[0].body.includes('Hemmelig'));assert.equal((await tick()).data.sent,0);
let data=await (await mf.dispatchFetch('https://test.invalid/api/hunt',{headers})).json();assert.equal(data.upcoming.length,1);assert.equal(data.upcoming[0].title,undefined);assert.equal(data.challenges.length,0);assert.equal(data.push.schedulerOnline,true);
// Move the release boundary for deterministic tests, without sleeping.
await db.prepare('UPDATE challenges SET start=?,end=?,created=? WHERE id=?').bind(now+1799000,now+5399000,now-100000,'c').run();r=await tick();assert.equal(r.data.sent,1);assert.equal(packets.at(-1).kind,'reminder');assert.equal((await tick()).data.sent,0,'no stale ready notice after reminder');
await db.prepare('UPDATE challenges SET daily=1,start=?,end=? WHERE id=?').bind(now-1000,now+3599000,'c').run();r=await tick();assert.equal(r.data.sent,1);assert.equal(packets.at(-1).kind,'start');assert(!packets.at(-1).body.includes('Hemmelig'),'daily start must not reveal word');assert.equal((await tick()).data.sent,0);
// Every reminder skips completed users, including all devices and invalidated photos.
await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) SELECT ?,user,?,p256dh,auth,created,updated FROM push_subscriptions LIMIT 1').bind('second','https://fcm.googleapis.com/fcm/send/second').run();
await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid,note) VALUES (?,?,?,?,?,?,0,?)').bind('done','c','owner','test',now,1000,'').run();
const count=packets.length;
for(const hour of [10,15,18,20,22]){await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-(hour-6)*3600000-1000,now+3600000,'c').run();assert.equal((await tick()).data.sent,0);assert.equal(packets.length,count)}
await db.prepare("DELETE FROM submissions WHERE id='done'").run();await db.prepare("DELETE FROM push_subscriptions WHERE id='second'").run();
await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-4*3600000-1000,now+3600000,'c').run();responseStatus=503;assert.equal((await tick()).data.failed,1);assert.equal(packets.at(-1).body,'Lyst på en fotojakt? Formiddagens oppgave er åpen til kl. 15.00.');
await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid,note) VALUES (?,?,?,?,?,?,1,?)').bind('done','c','owner','test',now,1000,'').run();await db.prepare('UPDATE push_deliveries SET next_attempt=0').run();const retryCount=packets.length;responseStatus=201;assert.equal((await tick()).data.sent,0);assert.equal(packets.length,retryCount,'completion stops failed-delivery retries');await db.prepare("DELETE FROM submissions WHERE id='done'").run();
await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-2000,now-1,'c').run();assert.equal((await tick()).data.sent,0,'ended challenge is cancelled');
// Optional social notifications run through the background dispatcher.
await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid,note) VALUES (?,?,?,?,?,?,1,?)').bind('social-photo','c','owner','test',now,1000,'').run();
await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,0)').bind('actor','Actor','','approved',now-10000,now-10000).run();
await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update('actor-session').digest('hex'),'actor',now+3600000).run();
await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('test-group','Test','owner',1)").run();
await db.prepare("INSERT INTO group_members(group_id,user,joined) SELECT 'test-group',id,1 FROM members").run();
async function social(body,user='actor-session'){const r=await mf.dispatchFetch('https://test.invalid/api/hunt',{method:'POST',headers:{cookie:'hunt_login='+user,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()}}
let pref=await(await mf.dispatchFetch('https://test.invalid/api/push',{headers})).json();assert.deepEqual(pref.preferences,{comments:false,reactions:false,replies:false,friends:true,groups:true});
assert.equal((await social({action:'react',id:'social-photo',emoji:'❤️'})).status,200);assert.equal((await db.prepare('SELECT COUNT(*) n FROM social_push').first()).n,0);
assert.equal((await post({action:'preferences',kind:'comments',enabled:true})).status,200);
assert.equal((await social({action:'comment',id:'social-photo',body:'Flott bilde'})).status,200);assert.equal((await tick()).data.sent,1);assert.equal(packets.at(-1).kind,'social');assert(packets.at(-1).body.includes('Actor'));assert(packets.at(-1).url.includes('season=season'));assert.equal((await tick()).data.sent,0);
assert.equal((await social({action:'comment',id:'social-photo',body:'Egen kommentar'},'test-session')).status,200);assert.equal((await tick()).data.sent,0,'no self notification');
assert.equal((await post({action:'preferences',kind:'reactions',enabled:true})).status,200);
assert.equal((await social({action:'react',id:'social-photo',emoji:'🔥'})).status,200);assert.equal((await tick()).data.sent,1);assert(packets.at(-1).body.includes('🔥'));
await social({action:'react',id:'social-photo',emoji:'🔥'});await social({action:'react',id:'social-photo',emoji:'🔥'});assert.equal((await tick()).data.sent,0,'toggle cannot spam notifications');
await db.prepare('UPDATE comments SET created=?').bind(now-10000).run();
assert.equal((await social({action:'comment',id:'social-photo',body:'Queued before opt-out'})).status,200);
assert((await db.prepare("SELECT COUNT(*) n FROM social_push WHERE status='pending'").first()).n>0);
assert.equal((await post({action:'notifications',enabled:false})).status,200);
assert.equal((await tick()).data.sent,0,'global opt-out cancels social delivery');
assert.equal((await post({action:'test',endpoint:subscription.endpoint})).status,400);
assert.equal((await post({action:'subscribe',installed:true,subscription})).status,200);
assert.equal((await(await mf.dispatchFetch('https://test.invalid/api/push',{headers})).json()).notificationsEnabled,false,'subscription sync must not re-enable notifications');
await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-2000,now+3600000,'c').run();
await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily) VALUES('off-hunt','season','Hemmelig',?,?,3600000,?,1)").bind(now-1000,now+3599000,now-5000).run();
const beforeOff=packets.length;assert.equal((await tick()).data.sent,0);assert.equal(packets.length,beforeOff,'global opt-out blocks hunt notifications');
assert.equal((await(await mf.dispatchFetch('https://test.invalid/api/hunt',{headers})).json()).user.status,'approved','playing without notifications allowed');
await db.prepare('UPDATE challenges SET end=? WHERE id=?').bind(now-1,'c').run();
await db.prepare("DELETE FROM challenges WHERE id='off-hunt'").run();
await post({action:'notifications',enabled:true});
await social({action:'react',id:'social-photo',emoji:'👏'});await post({action:'preferences',kind:'reactions',enabled:false});assert.equal((await tick()).data.sent,0,'opt-out cancels queued delivery');
pref=await(await mf.dispatchFetch('https://test.invalid/api/push',{headers})).json();assert.deepEqual(pref.preferences,{comments:true,reactions:false,replies:false,friends:true,groups:true},'independent choices persist');
assert.equal((await post({action:'preferences',kind:'invalid',enabled:true})).status,400);
// Replies always reach the inbox; phone delivery is an independent opt-in.
async function inbox(token){return (await(await mf.dispatchFetch('https://test.invalid/api/notifications',{headers:{cookie:'hunt_login='+token}})).json()).items}
async function comment(user,body,parent){await db.prepare('UPDATE comments SET created=?').bind(now-10000).run();assert.equal((await social({action:'comment',id:'social-photo',body,parent},user)).status,200);return await db.prepare('SELECT * FROM comments WHERE body=?').bind(body).first()}
await db.prepare("INSERT INTO members(id,name,email,status,joined,approved) VALUES('third','Third','','approved',1,1)").run();
await db.prepare("INSERT INTO group_members(group_id,user,joined) VALUES('test-group','third',1)").run();
await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update('third-session').digest('hex'),'third',now+3600000).run();
const root=await comment('actor-session','Reply root');await tick();
const child=await comment('test-session','Reply to actor',root.id);
assert.equal(child.reply_to,root.id);assert.equal(child.parent_id,root.id);
assert((await inbox('actor-session')).some(x=>x.id==='comment:'+child.id&&x.kind==='reply'),'reply inbox works with all preferences off and no device');
assert.equal((await tick()).data.sent,0);
await post({action:'preferences',kind:'replies',enabled:true});
const nested=await comment('third-session','Reply to owner child',child.id);
assert.equal(nested.parent_id,root.id);assert.equal(nested.reply_to,child.id,'nested reply retains actual target');
assert(!(await inbox('actor-session')).some(x=>x.id==='comment:'+nested.id),'root author must not receive replies addressed to a child');
assert.equal((await inbox('test-session')).filter(x=>x.id==='comment:'+nested.id&&x.kind==='reply').length,1);
assert.equal((await db.prepare("SELECT COUNT(*) n FROM social_push WHERE source=? AND status='pending'").bind(nested.id).first()).n,1,'photo owner receives one notification when comment and reply options are both enabled');
assert.equal((await tick()).data.sent,1);assert.equal(packets.at(-1).title,'💬 Svar på kommentaren din');assert(packets.at(-1).body.includes('Third'));
const off=await comment('third-session','Reply before opt-out',child.id);await post({action:'preferences',kind:'replies',enabled:false});
assert.equal((await tick()).data.sent,0);assert((await inbox('test-session')).some(x=>x.id==='comment:'+off.id),'turning off push leaves inbox intact');
await post({action:'preferences',kind:'replies',enabled:true});await post({action:'notifications',enabled:false});
const globalOff=await comment('third-session','Reply global off',child.id);assert.equal((await tick()).data.sent,0);assert((await inbox('test-session')).some(x=>x.id==='comment:'+globalOff.id));
await post({action:'notifications',enabled:true});
const revokedRoot=await comment('actor-session','Access root');await tick();
await db.prepare("INSERT INTO notification_preferences(user,replies) VALUES('actor',1)").run();
await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES(?,?,?,?,?,?,?)').bind('actor-device','actor','https://fcm.googleapis.com/fcm/send/actor',subscription.keys.p256dh,auth,now,now).run();
const revoked=await comment('third-session','Access reply',revokedRoot.id);
await db.prepare("DELETE FROM group_members WHERE user='actor'").run();
assert(!(await inbox('actor-session')).some(x=>x.id==='comment:'+revoked.id),'revoked photo access hides inbox reply');
const beforeRevocation=packets.length;await tick();assert.equal(packets.length,beforeRevocation+1,'only photo owner receives generic comment; revoked recipient is skipped');
assert.equal((await db.prepare("SELECT status FROM social_push WHERE source=? AND kind='reply'").bind(revoked.id).first()).status,'skipped');
await db.prepare("DELETE FROM push_subscriptions WHERE id='actor-device'").run();
await db.prepare("DELETE FROM submissions WHERE id='social-photo'").run();
// Word replacement notices are encrypted, neutral, deduplicated and optional.
await db.prepare("INSERT INTO hunt_changes(id,challenge,user,revision,created) VALUES('change-1','c','owner',0,?)").bind(Date.now()).run();const beforeWord=packets.length;await tick();assert.equal(packets.length,beforeWord+1);assert.equal(packets.at(-1).kind,'word-change');assert(packets.at(-1).body.includes('vanskelighetsgraden'));assert(!JSON.stringify(packets.at(-1)).includes('Hemmelig'));await tick();assert.equal(packets.length,beforeWord+1,'word-change push deduplicates');
await db.prepare("UPDATE challenges SET end=? WHERE id='c'").bind(Date.now()+3600000).run();await db.prepare("INSERT OR IGNORE INTO starts(challenge,user,started) VALUES('c','owner',?)").bind(Date.now()-1000).run();await db.prepare("INSERT INTO difficulty_polls(id,challenge,word,revision,actor,created,deadline) VALUES('poll','c','hemmelig nytt ord',0,'owner',?,?)").bind(Date.now(),Date.now()+3600000).run();await db.prepare("INSERT INTO hunt_changes(id,challenge,user,revision,created,kind,poll) VALUES('poll-notice','c','owner',0,?,'difficulty-poll','poll')").bind(Date.now()).run();await tick();assert.equal(packets.at(-1).kind,'difficulty-poll');assert(!JSON.stringify(packets.at(-1)).includes('hemmelig nytt ord'));const afterPoll=packets.length;await tick();assert.equal(packets.length,afterPoll);
await post({action:'notifications',enabled:false});await db.prepare("INSERT INTO hunt_changes(id,challenge,user,revision,created) VALUES('change-2','c','owner',0,?)").bind(Date.now()).run();await tick();assert.equal(packets.length,afterPoll,'push opt-out respected');assert((await inbox('test-session')).some(x=>x.kind==='word-change'),'bell notice remains');await post({action:'notifications',enabled:true});
await db.prepare('UPDATE members SET status=? WHERE id=?').bind('blocked','owner').run();assert.equal((await post({action:'subscribe',installed:true,subscription})).status,403);assert.equal((await tick()).data.sent,0);
await db.prepare('UPDATE members SET status=? WHERE id=?').bind('approved','owner').run();responseStatus=410;await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-3000,now+3599000,'c').run();await tick();assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,0);
// Lightning has no planning leak; warning and start reuse the real encrypted dispatcher.
responseStatus=201;await post({action:'subscribe',installed:true,subscription});
await db.prepare("UPDATE challenges SET end=? WHERE id NOT LIKE 'lightning:%'").bind(Date.now()-1).run();
const lightningNow=Date.now(),lightningId='lightning:test';
await db.prepare('UPDATE push_subscriptions SET created=?').bind(lightningNow-7200000).run();
await db.prepare('INSERT INTO challenges(id,season,title,start,end,duration,created) VALUES(?,?,?,?,?,?,?)').bind(lightningId,'season','noe mykt',lightningNow+3600000,lightningNow+4800000,1200000,lightningNow-3600000).run();
await db.prepare('INSERT INTO game_hunts(challenge,lightning) VALUES(?,1)').bind(lightningId).run();
const lightningPackets=()=>packets.filter(p=>p.tag?.startsWith(lightningId+':'));
const noLeak=lightningPackets().length;await tick();assert.equal(lightningPackets().length,noLeak,'lightning sends no early planning push');
let lightningData=await (await mf.dispatchFetch('https://test.invalid/api/hunt',{headers})).json();assert(!lightningData.upcoming.some(c=>c.id===lightningId),'random date hidden before warning');
await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(lightningNow+1799000,lightningNow+2999000,lightningId).run();
await tick();assert.equal(lightningPackets().at(-1).kind,'lightning-warning');assert(!lightningPackets().at(-1).body.includes('mykt'));assert.equal(lightningPackets().at(-1).url,'/?lightning=1');const afterWarning=lightningPackets().length;await tick();assert.equal(lightningPackets().length,afterWarning,'warning deduplicates');
lightningData=await (await mf.dispatchFetch('https://test.invalid/api/hunt',{headers})).json();assert(lightningData.lightningWarning.some(c=>c.id===lightningId));
await post({action:'notifications',enabled:false});await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(Date.now()-1000,Date.now()+1199000,lightningId).run();await tick();assert.equal(lightningPackets().length,afterWarning,'lightning respects opt-out');
await post({action:'notifications',enabled:true});await tick();assert.equal(lightningPackets().at(-1).kind,'lightning-start');assert(lightningPackets().at(-1).body.includes('noe mykt'));const afterStart=lightningPackets().length;await tick();assert.equal(lightningPackets().length,afterStart,'start deduplicates');
const unauthorized=await mf.dispatchFetch('https://test.invalid/api/hunt',{method:'POST',headers,body:JSON.stringify({action:'review-bonus',id:'any',status:'approved'})});assert.equal(unauthorized.status,403,'bonus review requires admin session');
console.log('PASS: lightning date privacy, real encrypted 30-minute warning/start, optional push, deduplication, warning UI and bonus admin authorization.');
console.log('PASS: encrypted Web Push round-trip, protected scheduler, endpoint validation, scheduled announcement, private countdown, 30-minute reminder, start alert, deduplication, cancellation, membership checks and expired subscriptions.');
}finally{await mf.dispose()}
