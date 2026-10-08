import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),packets=[];
const root=path.resolve('dist/server'),modules=(await readdir(root,{recursive:true})).filter(p=>p.endsWith('.js')).map(p=>({type:'ESModule',path:path.join(root,p)}));
modules.unshift({type:'ESModule',path:path.join(root,'judge-clock.js'),contents:"import handler from './index.js';let now=0;Date.now=()=>now;export default {fetch(req,env,ctx){now=Number(new URL(req.url).searchParams.get('clock'));return handler.fetch(req,env,ctx)}}"});
const mf=new Miniflare({modules,modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{PUSH_SCHEDULER_SECRET:'test-key'},cf:false,outboundService:async req=>{assert.equal(req.url,'https://exp.host/--/api/v2/push/send');packets.push(await req.json());return MFResponse.json({data:{status:'ok',id:'synthetic'}})}});
try{
 const db=await mf.getD1Database('DB');let now=Date.now(),jars={};
 for(const file of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(x=>x.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const [id,admin,role] of [['owner',1,null],['admin',1,null],['judge',0,'judge'],['head',0,'head_judge'],['head2',0,'head_judge'],['alice',0,null],['bob',0,null],['carol',0,null]]){
  await db.prepare("INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,'approved',1,1,?)").bind(id,id+' Person',id+'@secret.invalid',admin).run();
  await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(hash(id),id,now+864000000).run();
  await db.prepare('INSERT INTO sessions(token,user,expires) VALUES(?,?,?)').bind(hash('admin-'+id),id,now+864000000).run();
  await db.prepare('INSERT INTO local_accounts(user,login,salt,hash) VALUES(?,?,?,?)').bind(id,id,'test',crypto.pbkdf2Sync('123456','test',100000,32,'sha256').toString('hex')).run();
  if(role)await db.prepare('INSERT INTO staff_roles(user,role,updated,actor) VALUES(?,?,1,?)').bind(id,role,'owner').run();jars[id]='hunt_login='+id+'; hunt_admin=admin-'+id;
 }
 await db.prepare("INSERT INTO settings(key,value) VALUES('owner','owner')").run();
 const req=async(who,url,body,headers={})=>{const r=await mf.dispatchFetch('https://test.invalid'+url+(url.includes('?')?'&':'?')+'clock='+now,{method:body?'POST':'GET',headers:{...(who?{cookie:jars[who]}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:(r.headers.get('content-type')||'').includes('json')?await r.json():null,cookie:r.headers.get('set-cookie')}};
 const sign=[Array.from({length:12},(_,i)=>({x:.05+i*.025,y:.5+Math.sin(i)*.15}))];
 await db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('admin-agreement:owner',JSON.stringify({version:'2026-10-07.1',signature:'Old Typed Name',accepted:now})).run();
 for(const user of ['owner','admin','judge','head','head2']){
  assert.equal((await req(user,'/api/judging')).status,403,'handwritten signature required before any case');
  const access=await req(user,'/api/admin-access');assert.equal(access.status,200);assert.equal(access.data.accepted,false);
  const body={action:'accept',version:access.data.version,accepted:true,name:user+' Person',signature:sign};
  for(const signature of [[],[[{x:.5,y:.5}]],[[{x:NaN,y:.2}]],'Typed Name'])assert.equal((await req(user,'/api/admin-access',{...body,signature})).status,400);
  assert.equal((await req(user,'/api/admin-access',{...body,accepted:false})).status,400);
  assert.equal((await req(user,'/api/admin-access',body)).status,200);assert.equal((await req(user,'/api/admin-access',body)).status,200);
  assert.equal((await db.prepare('SELECT COUNT(*) n FROM staff_acceptances WHERE user=?').bind(user).first()).n,1,'duplicate signing idempotent');
 }
 assert.equal((await req('alice','/api/admin-access')).status,403);
 for(const who of ['judge','head','head2'])for(const url of ['/api/usage','/api/chat/moderation','/api/photo-reports'])assert.equal((await req(who,url)).status,403,url+' restricted');
 for(const who of ['judge','head'])assert.equal((await req(who,'/api/admin-access')).data.members,undefined);
 assert.equal((await req('admin','/api/admin-access?agreement=judge')).status,403,'only owner sees other signatures');
 const record=await req('owner','/api/admin-access?agreement=judge');assert.deepEqual(record.data.records[0].signature,sign);assert(!('email' in record.data.records[0]));
 for(const role of ['administrator','owner'])assert.equal((await req('admin','/api/admin-access',{action:'role',id:'alice',role})).status,role==='owner'?400:403);
 assert.equal((await req('admin','/api/admin-access',{action:'role',id:'owner',role:'player'})).status,403);
 assert.equal((await req('admin','/api/admin-access',{action:'role',id:'carol',role:'judge'})).status,200);
 assert.equal((await req('carol','/api/judging')).status,401,'role assignment revokes old sessions');
 const login=await req(null,'/api/auth',{action:'login',name:'carol',pin:'123456'});assert.equal(login.status,200);jars.carol=login.cookie.match(/hunt_login=([^;]+)/)[0]+'; '+login.cookie.match(/hunt_admin=([^;]+)/)[0];
 assert.equal((await req('carol','/api/admin-access')).data.role,'judge');assert.equal((await req('carol','/api/judging')).status,403);
 const version=(await req('carol','/api/admin-access')).data.version;assert.equal((await req('carol','/api/admin-access',{action:'accept',version,accepted:true,name:'Carol Person',signature:sign})).status,200);
 await db.prepare("INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES('blocked-staff','Blocked Judge','','blocked',1,1,0)").run();await db.prepare("INSERT INTO staff_roles(user,role,updated,actor) VALUES('blocked-staff','judge',1,'owner')").run();assert.equal((await req('admin','/api/admin-access',{action:'role',id:'blocked-staff',role:'player'})).status,200);assert.equal(await db.prepare("SELECT role FROM staff_roles WHERE user='blocked-staff'").first(),null,'role removal also clears blocked users instead of silently preserving access');
 await db.prepare("INSERT INTO seasons(id,name,start) VALUES('s','Synthetic Album',1)").run();
 for(const [id,end] of [['ended',now-1000],['active',now+3600000]])await db.prepare('INSERT INTO challenges(id,season,title,details,start,end,duration,created,daily) VALUES(?,?,?,?,?,?,?,?,0)').bind(id,'s',id==='active'?'SECRET ACTIVE WORD':'Test word','Test requirement',now-100000,end,100000,1).run();
 await db.prepare("INSERT INTO game_hunts(challenge,bonus) VALUES('ended','A blue object')").run();
 for(const user of ['owner','admin','judge','head','head2','alice','bob','carol']){
  const id='photo-'+user;await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid) VALUES(?,?,?,?,?,?,1)').bind(id,'ended',user,id+'.jpg',now-5000,user==='alice'?1000:2000).run();
  await (await mf.getR2Bucket('BUCKET')).put(id+'.jpg',await readFile('tests/fixtures/metadata.jpg'));
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('bonus-opt:'+id,'{}').run();await db.prepare("INSERT INTO bonus_reviews(submission,status,reason,updated) VALUES(?,'manual','Waiting',?)").bind(id,now).run();
  await db.prepare('INSERT INTO photo_admin_reports(id,submission,reporter,reason,created) VALUES(?,?,?,?,?)').bind('report-'+user,id,'bob','Wrong word',now).run();
 }
 await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES('locked','active','alice','locked.jpg',?,1000)").bind(now-1000).run();await db.prepare("INSERT INTO photo_admin_reports(id,submission,reporter,reason,created) VALUES('locked-report','locked','bob','SECRET REPORT',?)").bind(now).run();
 for(const who of ['owner','admin','judge','head','head2']){
  const q=await req(who,'/api/judging');assert.equal(q.status,200,JSON.stringify(q));assert(!JSON.stringify(q).includes('@secret.invalid'));assert(!JSON.stringify(q).includes('SECRET'));
  assert(!q.data.bonus.some(b=>b.submission==='photo-'+who));assert(!q.data.photos.some(b=>b.submission==='photo-'+who));
  for(const kind of ['bonus','photo'])assert.equal((await req(who,'/api/judging',{kind,id:'photo-'+who,status:'rejected',reason:'Self',expectedValid:true,expectedNote:''})).status,403,'no role judges own image');
 }
 for(const who of ['owner','admin','judge','head','head2'])assert.equal((await req(who,'/api/hunt',{action:'result',id:'photo-'+who,valid:false,seconds:1,note:'Self correction'})).status,403,'legacy correction cannot judge own image');
 assert.equal((await req('admin','/api/hunt',{action:'challenge',title:'Unauthorized',minutes:10,mode:'now'})).status,403,'only owner changes hunt settings');
 assert.equal((await req('judge','/api/judging',{kind:'photo',id:'photo-bob',status:'approved',elapsed:100,expectedValid:true,expectedNote:''})).status,403,'judge cannot alter elapsed time');
 // All hunt deliveries are now available to signed judges, without widening
 // general moderation access or revealing unfinished hunt secrets.
 for(const who of ['judge','head','head2']){
  const list=await req(who,'/api/admin-submissions?challenge=ended');assert.equal(list.status,200);assert.equal(list.data.items.length,8);assert(!JSON.stringify(list.data).includes('@secret.invalid'));
  assert.equal(list.data.items.find(s=>s.user===who).canJudge,false);
  assert.equal((await req(who,'/api/admin-submissions?challenge=active')).status,403);
  assert.equal((await req(who,'/api/photo/locked?review=hunt')).status,403);
  assert.equal((await req(who,'/api/photo/photo-alice?review=hunt')).status,200);
  assert.equal((await req(who,'/api/admin-submissions',{id:'photo-'+who,valid:false,category:'word',reason:'Self',expectedValid:true,expectedNote:''})).status,403);
 }
 await db.prepare("INSERT INTO challenges(id,season,title,details,start,end,duration,created,daily) VALUES('direct-review','s','Test word','Test requirement',?,?,100000,1,0)").bind(now-100000,now-1000).run();
 await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid) VALUES('unreported','direct-review','alice','unreported.jpg',?,3000,1)").bind(now-2000).run();await (await mf.getR2Bucket('BUCKET')).put('unreported.jpg',await readFile('tests/fixtures/metadata.jpg'));
 const ordinary={id:'unreported',valid:false,category:'word',reason:'Bildet passer ikke jaktordet.',expectedValid:true,expectedNote:''};
 assert.equal((await req('alice','/api/admin-submissions',ordinary)).status,403);
 assert.equal((await req('judge','/api/admin-submissions',{...ordinary,reason:' '})).status,400);
 const decisions=await Promise.all(['judge','head'].map(who=>req(who,'/api/admin-submissions',ordinary)));assert.deepEqual(decisions.map(r=>r.status).sort(),[200,409]);
 assert.equal((await db.prepare("SELECT valid,elapsed FROM submissions WHERE id='unreported'").first()).valid,0);assert.equal((await db.prepare("SELECT elapsed FROM submissions WHERE id='unreported'").first()).elapsed,3000);
 const judgedList=await req('judge','/api/admin-submissions?challenge=direct-review');assert.equal(judgedList.data.items.find(s=>s.id==='unreported').canJudge,false);
 const restore={...ordinary,valid:true,category:'restore',reason:'Ny vurdering bekrefter motivet.',expectedValid:false,expectedNote:'Passer ikke ordet: Bildet passer ikke jaktordet.'};
 assert.equal((await req('judge','/api/admin-submissions',restore)).status,403,'judge cannot overrule');assert.equal((await req('admin','/api/admin-submissions',restore)).status,403,'administrator cannot overrule');
 const unreportedD=await db.prepare("SELECT id FROM review_decisions WHERE submission='unreported' AND current=1").first();assert.equal((await req('alice','/api/appeals',{decision:unreportedD.id,reason:'Motivet passer.'})).status,200);
 const unreportedA=await db.prepare('SELECT id FROM review_appeals WHERE decision=?').bind(unreportedD.id).first();assert.equal((await req('head2','/api/judging',{action:'resolve-appeal',id:unreportedA.id,approve:true,reason:'Motivet oppfyller kravet.'})).status,200);
 assert.equal((await db.prepare("SELECT valid FROM submissions WHERE id='unreported'").first()).valid,1);
 await db.prepare("DELETE FROM challenges WHERE id='direct-review'").run();
 assert.equal((await req('judge','/api/photo/locked?review=case')).status,403);
 assert.equal((await req('judge','/api/photo/photo-alice?review=case')).status,200);
 assert.equal((await req('alice','/api/photo/photo-bob?review=case')).status,403);
 assert.equal((await req('judge','/api/judging',{kind:'bonus',id:'photo-alice',status:'rejected',reason:' '})).status,400);
 const concurrent=await Promise.all(['rejected','approved'].map(status=>req('judge','/api/judging',{kind:'bonus',id:'photo-alice',status,reason:'Need more blue'})));assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);
 let d=await db.prepare("SELECT * FROM review_decisions WHERE submission='photo-alice' AND kind='bonus' AND current=1").first();
 if(d.status!=='rejected'){assert.equal((await req('head','/api/judging',{kind:'bonus',id:'photo-alice',status:'rejected',reason:'Not blue',override:true,decision:d.id})).status,200);d=await db.prepare("SELECT * FROM review_decisions WHERE submission='photo-alice' AND kind='bonus' AND current=1").first();}
 assert.equal((await req('bob','/api/appeals',{decision:d.id,reason:'Spoof'})).status,409);
 assert.equal((await req('alice','/api/appeals',{decision:d.id,reason:' '})).status,400);
 assert.equal((await req('alice','/api/appeals',{decision:d.id,reason:'The blue object is visible'})).status,200);assert.equal((await req('alice','/api/appeals',{decision:d.id,reason:'Duplicate'})).status,409);
 const a=await db.prepare('SELECT * FROM review_appeals WHERE decision=?').bind(d.id).first();
 assert.equal((await req(d.actor,'/api/judging',{action:'resolve-appeal',id:a.id,approve:true,reason:'Own decision'})).status,403);
 assert.equal((await req('admin','/api/judging',{action:'resolve-appeal',id:a.id,approve:true,reason:'Admin only views'})).status,403);
 assert.equal((await req('head2','/api/judging',{action:'resolve-appeal',id:a.id,approve:true,reason:' '})).status,400);
 const results=await Promise.all([true,false].map(approve=>req('head2','/api/judging',{action:'resolve-appeal',id:a.id,approve,reason:'Blue object confirmed'})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const resolved=await db.prepare('SELECT * FROM review_appeals WHERE id=?').bind(a.id).first();const bonus=await db.prepare("SELECT * FROM bonus_reviews WHERE submission='photo-alice'").first();assert.equal(bonus.status,resolved.status==='approved'?'approved':'rejected');
 assert.equal((await req('head2','/api/judging',{action:'resolve-appeal',id:a.id,approve:resolved.status!=='approved',reason:'Replay'})).status,409);assert.equal((await db.prepare("SELECT status FROM bonus_reviews WHERE submission='photo-alice'").first()).status,bonus.status);
 let state=await req('alice','/api/hunt?season=s');let points=state.data.leaderboard.find(p=>p.id==='alice').points;assert.equal(points,resolved.status==='approved'?12:10,'derived score has bonus at most once');
 const notifications=await req('alice','/api/notifications');assert(notifications.data.items.some(n=>n.id==='appeal:'+a.id));
 assert.equal((await req('head','/api/judging',{kind:'photo',id:'photo-bob',status:'rejected',reason:'Incorrect motif',expectedValid:true,expectedNote:''})).status,200);
 const photoD=await db.prepare("SELECT * FROM review_decisions WHERE submission='photo-bob' AND kind='photo' AND current=1").first();assert.equal((await req('bob','/api/appeals',{decision:photoD.id,reason:'Please check again'})).status,200);const photoA=await db.prepare('SELECT * FROM review_appeals WHERE decision=?').bind(photoD.id).first();
 assert.equal((await req('head','/api/judging',{action:'resolve-appeal',id:photoA.id,approve:true,reason:'Own ruling'})).status,403);
 assert.equal((await req('head2','/api/judging',{action:'resolve-appeal',id:photoA.id,approve:true,reason:'Motif matches'})).status,200);assert.equal((await db.prepare("SELECT valid FROM submissions WHERE id='photo-bob'").first()).valid,1);
 assert.equal((await req('judge','/api/judging',{kind:'photo',id:'photo-carol',status:'rejected',reason:'Wrong motif',expectedValid:true,expectedNote:''})).status,200);
 const carolD=await db.prepare("SELECT id FROM review_decisions WHERE submission='photo-carol' AND kind='photo' AND current=1").first();assert.equal((await req('head2','/api/judging',{kind:'photo',id:'photo-carol',status:'approved',reason:'Motif is acceptable',expectedValid:false,expectedNote:'Wrong motif',override:true,decision:carolD.id})).status,200);
 assert.equal((await db.prepare("SELECT COUNT(*) n FROM review_decisions WHERE submission='photo-carol'").first()).n,2);
 // Optional Expo delivery, opt-out at send time, no double delivery.
 for(const user of ['alice','bob'])await db.prepare("INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated,provider) VALUES(?,?,?,'','',?,?,'expo')").bind('expo-'+user,user,'ExpoPushToken['+user+'abcdefghijklmnop]',now,now).run();
 await db.prepare("INSERT INTO settings(key,value) VALUES('push_disabled:bob','1')").run();
 const prior=await db.prepare("SELECT * FROM review_decisions WHERE submission='photo-alice' AND kind='bonus' AND current=1").first();assert.equal((await req('head','/api/judging',{kind:'bonus',id:'photo-alice',status:'approved',reason:'Updated review',override:true,decision:prior.id})).status,200);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM review_push').first()).n,1);
 await req(null,'/api/push/tick',{}, {'x-photo-hunt-scheduler-key':'test-key'});await req(null,'/api/push/tick',{}, {'x-photo-hunt-scheduler-key':'test-key'});assert.equal(packets.length,1);assert.equal(packets[0].channelId,'social');assert(!JSON.stringify(packets).includes('Test word'));
 assert.equal((await req('owner','/api/hunt',{action:'result',id:'photo-bob',valid:true,seconds:8,note:'Documented timing correction'})).status,200,'owner correction follows decision history');assert.equal((await db.prepare("SELECT elapsed FROM submissions WHERE id='photo-bob'").first()).elapsed,8000);
 // Backend role revocation invalidates both current sessions and stale permission claims.
 assert.equal((await req('admin','/api/admin-access',{action:'role',id:'judge',role:'player'})).status,200);assert.equal((await req('judge','/api/judging')).status,401);assert.equal((await req('judge','/api/admin-submissions?challenge=ended')).status,401);assert.equal((await req('judge','/api/photo/photo-alice?review=hunt')).status,401);assert.equal((await db.prepare("SELECT COUNT(*) n FROM sessions WHERE user='judge'").first()).n,0);
 let doc=(await req('owner','/api/admin-access')).data;
 assert.equal((await req('admin','/api/admin-access',{action:'document',text:doc.text,expectedVersion:doc.version,material:true})).status,403);
 assert.equal((await req('owner','/api/admin-access',{action:'document',text:doc.text+'\nPresisering uten nye plikter.',expectedVersion:doc.version,material:false})).status,200);assert.equal((await req('head2','/api/judging')).status,200,'minor correction keeps acceptance');
 doc=(await req('owner','/api/admin-access')).data;assert.equal((await req('owner','/api/admin-access',{action:'document',text:doc.text+'\nVesentlig endring i pliktene.',expectedVersion:doc.version,material:true})).status,200);
 for(const who of ['owner','admin','head','head2','carol'])assert.equal((await req(who,'/api/judging')).status,403,'material change requires re-signing');
 now+=10;const fresh=(await req('owner','/api/admin-access')).data;assert.equal((await req('owner','/api/admin-access',{action:'accept',version:doc.version,accepted:true,name:'Owner Person',signature:sign})).status,400);assert.equal((await req('owner','/api/admin-access',{action:'accept',version:fresh.version,accepted:true,name:'Owner Person',signature:sign})).status,200);
 assert.equal((await req('owner','/api/admin-access?agreement=owner')).data.records.length,2,'signature history retained');assert.equal((await req('owner','/api/admin-access?agreement=owner')).data.legacy.version,'2026-10-07.1','previous typed declaration retained');
 assert.equal((await req('owner','/api/judging',{}, {origin:'https://evil.invalid'})).status,403);
 console.log('PASS: role matrix, personal judge login, compulsory nonempty handwritten signatures, owner-only signature access, history, minor/material document versions, immediate revocation, minimal case data, locked hunts, all-role self-review ban, concurrent decisions and appeals, independent appeal reviewer, image/bonus restoration, scoring without duplication, in-app notice, voluntary Expo push and deduplication.');
}finally{await mf.dispose()}
