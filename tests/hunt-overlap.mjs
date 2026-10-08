import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare'),ts=require('typescript'),webpush=require('web-push'),ece=createRequire(require.resolve('web-push'))('http_ece');
const timeCode=ts.transpile(await readFile('lib/hunt-times.ts','utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
const {osloTime,osloDay,huntWindow,nextDay,afternoonLocked,orderHunts}=await import('data:text/javascript;base64,'+Buffer.from(timeCode).toString('base64'));
for(const day of ['2026-10-08','2026-10-25','2027-03-28']){
 const am={id:'am',season:'s',day,daily:1,slot:1,...huntWindow(day,1)},pm={id:'pm',season:'s',day,daily:1,slot:2,...huntWindow(day,2)},list=[am,pm];
 assert.equal(am.start,osloTime(day,6));assert.equal(am.end,osloTime(day,17));assert.equal(pm.start,osloTime(day,14));assert.equal(pm.end,osloTime(nextDay(day),0));
 assert.equal(afternoonLocked(pm,list,[],'alice',osloTime(day,14)),true);
 assert.equal(afternoonLocked(pm,list,[{challenge:'am',user:'bob'}],'alice',osloTime(day,16)),true);
 assert.equal(afternoonLocked(pm,list,[{challenge:'am',user:'alice'}],'alice',osloTime(day,14)),false);
 assert.equal(afternoonLocked(pm,list,[{challenge:'am',user:'alice'}],'alice',osloTime(day,16)+1800000),false);
 assert.equal(afternoonLocked(pm,list,[],'alice',osloTime(day,17)-1),true);
 assert.equal(afternoonLocked(pm,list,[],'alice',osloTime(day,17)),false);
 assert.equal(afternoonLocked(pm,list,[],'alice',osloTime(day,14),{started:1}),false,'rollout keeps existing attempts');
 assert.deepEqual(orderHunts([{...pm,locked:true},{...am,locked:false}]).map(c=>c.id),['am','pm']);
}
assert.equal(new Date(osloTime('2026-10-25',6)).toISOString(),'2026-10-25T05:00:00.000Z');
assert.equal(new Date(osloTime('2027-03-28',6)).toISOString(),'2027-03-28T04:00:00.000Z');
const vapid=webpush.generateVAPIDKeys(),receiver=crypto.createECDH('prime256v1');receiver.generateKeys();const auth=crypto.randomBytes(16).toString('base64url'),packets=[];
const root=path.resolve('dist/server'),modules=(await readdir(root,{recursive:true})).filter(p=>p.endsWith('.js')).map(p=>({type:'ESModule',path:path.join(root,p)}));
// Test-only entry supplies a deterministic clock to the real production Worker.
modules.unshift({type:'ESModule',path:path.join(root,'test-clock.js'),contents:"import handler from './index.js';let clock=0;Date.now=()=>clock;export default {fetch(req,env,ctx){clock=Number(new URL(req.url).searchParams.get('_testNow'));return handler.fetch(req,env,ctx)}}"});
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{VAPID_PUBLIC_KEY:vapid.publicKey,VAPID_PRIVATE_KEY:vapid.privateKey,PUSH_SCHEDULER_SECRET:'test-key'},cf:false,outboundService:async req=>{if(req.url==='https://exp.host/--/api/v2/push/send'){packets.push({provider:'expo',...await req.json()});return MFResponse.json({data:{status:'ok',id:'ticket'}})}assert(req.url.startsWith('https://fcm.googleapis.com/'));const payload=JSON.parse(ece.decrypt(Buffer.from(await req.arrayBuffer()),{version:'aes128gcm',privateKey:receiver,authSecret:auth}).toString());packets.push({provider:'webpush',...payload});return new MFResponse('',{status:201})}});
try{
 const db=await mf.getD1Database('DB'),day='2027-03-28',begin=osloTime(day,6);let now=begin;
 for(const file of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 for(const user of ['alice','bob','carol','admin']){
  await db.prepare("INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,'approved',1,1,?)").bind(user,user,'',user==='admin'?1:0).run();
  await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(hash(user),user,begin+90*86400000).run();
  await db.prepare('INSERT INTO rules_acceptances(user_id,rules_version,accepted_at) VALUES(?,?,1)').bind(user,'2026-10-07.1').run();
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('privacy:'+user,JSON.stringify({analytics:false,pushPreview:true})).run();
 }
 await db.prepare("INSERT INTO settings(key,value) VALUES('owner','admin')").run();await db.prepare('INSERT INTO sessions(token,user,expires) VALUES(?,?,?)').bind(hash('admin-cookie'),'admin',begin+86400000).run();await db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('admin-agreement:admin',JSON.stringify({version:'2026-10-07.1',accepted:1})).run();
 await seedStaffAcceptance(db,"admin",1);
 await db.prepare("INSERT INTO seasons(id,name,start,daily,first_day,last_day) VALUES('s','Test',?,1,?,?)").bind(begin,day,day).run();
 for(const slot of [1,2]){const start=osloTime(day,slot===1?6:15),end=slot===1?osloTime(day,15):osloTime(nextDay(day),0);await db.prepare("INSERT INTO challenges(id,season,title,details,start,end,duration,created,daily,day,slot) VALUES(?,'s',?,?,?,?,?,?,1,?,?)").bind(slot===1?'am':'pm',slot===1?'AM SECRET':'PM SECRET','SECRET DESCRIPTION',start,end,end-start,begin-86400000,day,slot).run();await db.prepare('INSERT INTO game_hunts(challenge,bonus) VALUES(?,?)').bind(slot===1?'am':'pm','SECRET BONUS').run();}
 // Isolate scheduled daily pushes from an unrelated randomly timed weekly hunt.
 await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily) VALUES('lightning:test','s','Synthetic past lightning',?,?,1000,1,0)").bind(begin-86400000,begin-86400000+1000).run();await db.prepare("INSERT INTO game_hunts(challenge,week,lightning) VALUES('lightning:test','2027-03-22',1)").run();
 await db.prepare("INSERT INTO captures(token,user,challenge,expires,issued) VALUES('legacy-camera','bob','am',?,?)").bind(osloTime(day,15)+86400000,begin).run();
 await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily,day,slot) VALUES('historic','s','HISTORIC',1,2,1,1,1,'2026-01-01',1)").run();
 for(const user of ['alice','bob'])for(const provider of ['expo','webpush'])await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated,provider) VALUES(?,?,?,?,?,?,?,?)').bind(user+provider,user,provider==='expo'?'ExpoPushToken['+user+'abcdefghijklmnop]':'https://fcm.googleapis.com/'+user,provider==='expo'?'':receiver.getPublicKey().toString('base64url'),provider==='expo'?'':auth,begin-86400000,begin,provider).run();
 async function request(user,url,body){const encoded=body instanceof FormData?new Response(body):null,headers={...(user?{cookie:'hunt_login='+user+(user==='admin'?'; hunt_admin=admin-cookie':'')}:{'x-photo-hunt-scheduler-key':'test-key'}),...(body?{'content-type':encoded?encoded.headers.get('content-type'):'application/json'}:{})};const r=await mf.dispatchFetch('https://test.invalid'+url+(url.includes('?')?'&':'?')+'_testNow='+now,{method:body?'POST':'GET',headers,...(body?{body:encoded?new Uint8Array(await encoded.arrayBuffer()):JSON.stringify(body)}:{})});const data=await r.json();return {status:r.status,data}}
 const tick=()=>request(null,'/api/push/tick',{});
 assert.equal((await tick()).data.sent,0,'no push at 06, including season start');assert.equal((await db.prepare("SELECT end FROM challenges WHERE id='am'").first()).end,osloTime(day,17));assert.equal((await db.prepare("SELECT start FROM challenges WHERE id='pm'").first()).start,osloTime(day,14));assert.equal((await db.prepare("SELECT expires FROM captures WHERE token='legacy-camera'").first()).expires,osloTime(day,17)+86400000);assert.equal((await db.prepare("SELECT end FROM challenges WHERE id='historic'").first()).end,2);
 now=osloTime(day,7);assert.equal((await tick()).data.sent,4,'07 push reaches two web and two Expo devices');assert.equal((await tick()).data.sent,0,'no duplicates on retry');assert(packets.every(p=>!JSON.stringify(p).includes('SECRET')));
 await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES('bob-am','am','bob','bob.jpg',?,1000)").bind(now).run();
 now=osloTime(day,10);assert.equal((await tick()).data.sent,2,'completed morning receives no reminder');
 now=osloTime(day,14)-1;assert.equal((await request('bob','/api/hunt',{action:'start-daily',id:'pm'})).status,400);
 now=osloTime(day,14);let state=await request('alice','/api/hunt');assert.equal(state.data.challenges.find(c=>c.id==='pm').locked,true);assert(!JSON.stringify(state.data).includes('PM SECRET'));assert(!JSON.stringify(state.data).includes('SECRET BONUS'));
 assert.equal((await request('alice','/api/hunt',{action:'start-daily',id:'pm'})).status,403);assert.equal((await request('alice','/api/hunt',{action:'camera',id:'pm'})).status,403);
 assert.equal((await request('admin','/api/hunt',{action:'start-daily',id:'pm'})).status,403,'admin cannot bypass lock');assert(!JSON.stringify((await request('admin','/api/hunt')).data).includes('PM SECRET'));
 assert.equal((await request('bob','/api/hunt',{action:'start-daily',id:'pm'})).status,200);assert.equal((await tick()).data.sent,2,'14 push only to users whose morning is complete');assert.equal((await tick()).data.sent,0);
 await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('g','Test','bob',1)").run();for(const user of ['alice','bob','admin'])await db.prepare("INSERT INTO group_members(group_id,user,joined) VALUES('g',?,1)").bind(user).run();await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,caption) VALUES('bob-pm','pm','bob','bob-pm.jpg',?,1000,'PM CAPTION SECRET')").bind(now).run();await(await mf.getR2Bucket('BUCKET')).put('bob-pm.jpg',await readFile('tests/fixtures/metadata.jpg'));
 assert.equal((await request('alice','/api/photo/bob-pm')).status,403);assert.equal((await request('admin','/api/photo/bob-pm?review=hunt')).status,403);assert(!(await request('alice','/api/hunt')).data.challenges.find(c=>c.id==='pm').submissions.length);assert(!JSON.stringify((await request('alice','/api/hunt?profile=bob')).data).includes('PM SECRET'));assert(!JSON.stringify((await request('alice','/api/hunt?profile=bob')).data).includes('PM CAPTION SECRET'));
 now=osloTime(day,16)+1800000;assert.equal((await request('alice','/api/hunt',{action:'start-daily',id:'am'})).status,200);const cam=(await request('alice','/api/hunt',{action:'camera',id:'am'})).data;
 now+=23583;const form=new FormData();form.set('challenge','am');form.set('token',cam.token);form.set('taken',String(now));form.set('photo',new Blob([await readFile('tests/fixtures/metadata.jpg')],{type:'image/jpeg'}),'capture.jpg');
 const upload=await request('alice','/api/hunt',form);assert.equal(upload.status,200,JSON.stringify(upload));assert.equal(upload.data.elapsed,23583);assert.equal((await request('alice','/api/hunt',form)).status,200,'upload retry idempotent');
 assert.equal((await request('alice','/api/hunt',{action:'start-daily',id:'pm'})).status,200,'16:30 completion unlocks afternoon immediately');
 now=osloTime(day,17)-1;assert.equal((await request('carol','/api/hunt',{action:'start-daily',id:'pm'})).status,403);
 now=osloTime(day,17);assert.equal((await request('carol','/api/hunt',{action:'start-daily',id:'pm'})).status,200,'17 unlocks even without morning submission');assert.equal((await request('carol','/api/hunt',{action:'camera',id:'am'})).status,400);
 now=osloTime(nextDay(day),0);assert.equal((await request('alice','/api/hunt',{action:'camera',id:'pm'})).status,400,'midnight closes afternoon');
 // Consent, real small-cohort summaries, session concurrency, spoof protection, withdrawal.
 now=osloTime(day,16);await request('alice','/api/usage',{event:'visit'});assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_daily').first()).n,0);
 assert.equal((await request('alice','/api/privacy',{action:'analytics',analytics:true})).status,200);assert.equal(JSON.parse((await db.prepare("SELECT value FROM settings WHERE key='privacy:alice'").first()).value).analytics,true);
 await Promise.all([request('alice','/api/usage',{event:'visit',user:'bob'}),request('alice','/api/usage',{event:'visit'})]);await request('alice','/api/usage',{event:'camera'});
 let stats=await request('admin','/api/usage?days=7');assert.equal(stats.status,200,JSON.stringify(stats));assert.equal(stats.data.totals.consented,1);assert.equal(stats.data.totals.users,1);assert.equal(stats.data.totals.visits,2);assert.equal(stats.data.totals.sessions,1);assert.equal(stats.data.daily.length,7);assert.equal(stats.data.features.find(f=>f.event==='camera').count,1);assert.deepEqual(stats.data.users,[]);assert.equal(stats.data.suppressed,false);assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_daily WHERE user='bob'").first()).n,0);
 now+=1800000;await request('alice','/api/usage',{event:'visit'});stats=await request('admin','/api/usage?days=30');assert.equal(stats.data.totals.sessions,2);assert.equal(stats.data.daily.length,30);
 assert.equal((await request('bob','/api/usage')).status,403);assert.equal((await request('alice','/api/usage',{event:'session'})).status,400);
 await Promise.all([request('alice','/api/privacy',{action:'analytics',analytics:false}),request('alice','/api/usage',{event:'camera'})]);await request('alice','/api/usage',{event:'visit'});assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_daily WHERE user='alice'").first()).n,0);assert.equal((await db.prepare("SELECT COUNT(*) n FROM usage_activity WHERE user='alice'").first()).n,0);
 await db.prepare("UPDATE settings SET value='invalid-json' WHERE key='privacy:alice'").run();assert.equal((await request('alice','/api/privacy')).status,503,'storage errors must not masquerade as absent consent');
 console.log('PASS: Oslo/DST boundaries, overlap, API locks/admin, 16:30 and 17 unlock, shutter time and retry, optional Web/Expo push at 07/no06/no duplicates/no reminders after completion, consent persistence, atomic sessions, real admin summaries, spoof protection and withdrawal.');
}finally{await mf.dispose()}
