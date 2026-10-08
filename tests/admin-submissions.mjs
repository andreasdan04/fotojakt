import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {rank} from '../lib/scoring.ts';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false,outboundService:async()=>{throw Error('Unexpected outbound transfer')}});
try{
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET'),now=Date.now(),jpeg=await readFile('tests/fixtures/metadata.jpg');
 for(const file of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const s of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(s).run();
 for(const [id,isAdmin,signed] of [['reviewer',1,true],['unsigned',1,false],['player',0,false]]){
  await db.prepare("INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,'approved',1,1,?)").bind(id,id,'',isAdmin).run();
  await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(hash(id),id,now+86400000).run();
  if(isAdmin)await db.prepare('INSERT INTO sessions(token,user,expires) VALUES(?,?,?)').bind(hash('admin-'+id),id,now+86400000).run();
  if(signed)await db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('admin-agreement:'+id,JSON.stringify({version:'2026-10-07.1',accepted:now})).run();
  if(signed)await seedStaffAcceptance(db,id,now);
 }
 const req=(who,url)=>mf.dispatchFetch('https://test.invalid'+url,{headers:who?{cookie:'hunt_login='+who+'; hunt_admin=admin-'+who}:{}});
 const review=(who,b,origin)=>mf.dispatchFetch('https://test.invalid/api/admin-submissions',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{origin}:{}),...(who?{cookie:'hunt_login='+who+'; hunt_admin=admin-'+who}:{})},body:JSON.stringify(b)});
 await db.prepare("INSERT INTO settings(key,value) VALUES('owner','reviewer')").run();
 const verdict={id:'photo-0',valid:false,category:'word',reason:'Motivet passer ikke ordet.',expectedValid:true,expectedNote:''};
 await db.prepare("INSERT INTO seasons(id,name,start) VALUES('s','Synthetic Album',1)").run();
 for(const [id,start,end,daily] of [['completed',now-100000,now-1000,1],['active',now-10000,now+3600000,1],['future',now+3600000,now+4800000,0]])await db.prepare('INSERT INTO challenges(id,season,title,details,start,end,duration,created,daily) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'s',id==='future'?'SECRET FUTURE MOTIF':'SYNTHETIC '+id,'SECRET DESCRIPTION',start,end,end-start,1,daily).run();
 await db.prepare("INSERT INTO game_hunts(challenge,week,lightning) VALUES('future','synthetic-week',1)").run();
 // Unrelated users, including a blocked account and an invalid submission.
 for(let i=0;i<45;i++){
  const user='outside-'+i,id='photo-'+i;
  await db.prepare('INSERT INTO members(id,name,username,email,status,joined,approved,admin) VALUES(?,?,?,?,?,1,1,0)').bind(user,'Synthetic Person '+i,user,'',i===44?'blocked':'approved').run();
  await db.prepare('INSERT INTO starts(challenge,user,started) VALUES(?,?,?)').bind('completed',user,now-100000).run();
  await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid,caption) VALUES(?,?,?,?,?,?,?,?)').bind(id,'completed',user,'photos/'+id,now-1000+i,9000,i===44?0:1,'Synthetic caption').run();
  await bucket.put('photos/'+id,jpeg);
 }
 await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES('active-photo','active','outside-0','photos/active',?,9000)").bind(now).run();await bucket.put('photos/active',jpeg);
 assert.equal((await req(null,'/api/admin-submissions')).status,401);
 for(const user of ['player','unsigned']){assert.equal((await req(user,'/api/admin-submissions')).status,403);assert.equal((await req(user,'/api/photo/photo-0?review=hunt')).status,403);}
 const overview=await(await req('reviewer','/api/admin-submissions?season=s')).json();
 assert.equal(overview.hunts.find(h=>h.id==='active').canReview,false);assert.equal(overview.hunts.find(h=>h.id==='completed').canReview,true);assert.equal(overview.hunts.find(h=>h.id==='future').title,'Hemmelige lynjaktord');assert(!JSON.stringify(overview).includes('SECRET FUTURE MOTIF'));assert(!JSON.stringify(overview).includes('SECRET DESCRIPTION'));
 assert.equal((await req('reviewer','/api/admin-submissions?challenge=active')).status,403);assert.equal((await req('reviewer','/api/photo/active-photo?review=hunt')).status,403);
 assert.equal((await review(null,verdict)).status,401);
 for(const who of ['player','unsigned'])assert.equal((await review(who,verdict)).status,403);
 assert.equal((await review('reviewer',{...verdict,id:'active-photo'})).status,403);
 assert.equal((await review('reviewer',verdict,'https://evil.invalid')).status,403);
 assert.equal((await review('reviewer',{...verdict,reason:' '})).status,400);
 assert.equal((await review('reviewer',{...verdict,category:'bogus'})).status,400);
 const firstResponse=await req('reviewer','/api/admin-submissions?challenge=completed'),first=await firstResponse.json();assert.equal(firstResponse.status,200);assert.equal(first.items.length,36);assert.equal(first.total,45);assert(first.hasMore);assert.equal(first.participants.length,45);assert.equal(first.items.find(s=>s.user==='outside-44').status,'blocked');assert.equal(first.items.find(s=>s.user==='outside-44').valid,0);assert(!first.items.some(s=>'key' in s));
 const second=await(await req('reviewer','/api/admin-submissions?challenge=completed&before='+encodeURIComponent(first.nextBefore))).json();assert.equal(second.items.length,9);assert.equal(second.hasMore,false);assert.equal(new Set([...first.items,...second.items].map(s=>s.id)).size,45,'cursor retrieves every user without duplicates');
 const filtered=await(await req('reviewer','/api/admin-submissions?challenge=completed&user=outside-0')).json();assert.equal(filtered.total,1);assert.equal(filtered.items.length,1);assert.equal(filtered.items[0].registeredPhotoTime,now-91000);assert.equal(filtered.items[0].submitted,now-1000,'server receipt is distinct from computed photo time');
 assert.equal((await req('reviewer','/api/admin-submissions?challenge=completed&before=invalid')).status,400);
 assert.equal((await req('reviewer','/api/photo/photo-0')).status,403,'normal player gallery keeps its audience boundary');
 const photo=await req('reviewer','/api/photo/photo-0?review=hunt');assert.equal(photo.status,200);assert.equal(photo.headers.get('cache-control'),'private, no-store');assert.deepEqual(Buffer.from(await photo.arrayBuffer()),jpeg);
 const audit=(await db.prepare("SELECT value FROM settings WHERE key LIKE 'privacy-audit:%'").all()).results.map(x=>JSON.parse(x.value));assert(audit.some(x=>x.actor==='reviewer'&&x.action==='hunt-submission-list'&&x.ids.includes('photo-0')));assert(audit.some(x=>x.actor==='reviewer'&&x.action==='hunt-submission-photo'&&x.ids.includes('photo-0')));assert(!JSON.stringify(audit).includes('Synthetic Person'));
 await db.prepare("INSERT INTO photo_reports(submission,reporter,reason,created,deadline,status,threshold,applied) VALUES('photo-0','reviewer','Synthetic report',?,?,'open',3,0)").bind(now,now+10000).run();
 const points=async()=>rank([{id:'completed',daily:1,start:now-100000,end:now-1000}],(await db.prepare("SELECT * FROM submissions WHERE challenge='completed'").all()).results,[{id:'outside-0',name:'Synthetic',approved:1}],now)[0].points;
 assert.equal(await points(),10);
 const invalid=await review('reviewer',verdict);assert.equal(invalid.status,200);const judged=await invalid.json();assert.equal(judged.valid,0);assert.equal(judged.note,'Passer ikke ordet: Motivet passer ikke ordet.');
 const stored=await db.prepare("SELECT valid,note,elapsed FROM submissions WHERE id='photo-0'").first();assert.equal(stored.valid,0);assert.equal(stored.elapsed,9000,'assessment never changes elapsed time');
 assert.equal(await points(),0,'invalidated photo no longer earns hunt points');
 const report=await db.prepare("SELECT status,applied FROM photo_reports WHERE submission='photo-0'").first();assert.equal(report.status,'admin');assert.equal(report.applied,1);
 assert.equal((await review('reviewer',verdict)).status,409,'stale assessment cannot overwrite a newer one');
 const reviewAudits=(await db.prepare("SELECT value FROM settings WHERE key LIKE 'privacy-audit:%'").all()).results.map(x=>JSON.parse(x.value)).filter(x=>x.action==='judge-decision'&&x.kind==='photo');assert.equal(reviewAudits.length,1);assert.equal(reviewAudits[0].actor,'reviewer');assert.deepEqual(reviewAudits[0].ids,['photo-0']);assert.equal(reviewAudits[0].status,'rejected');
 const restored=await review('reviewer',{...verdict,valid:true,category:'restore',reason:'Motivet er godkjent etter ny vurdering.',expectedValid:false,expectedNote:judged.note});assert.equal(restored.status,200);assert.equal((await restored.json()).valid,1);
 assert.equal(await points(),10,'reinstated photo earns its original placement again');
 await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES('own','active','reviewer','photos/own',?,9000)").bind(now).run();
 assert.equal((await req('reviewer','/api/admin-submissions?challenge=active')).status,200);assert.equal((await req('reviewer','/api/photo/active-photo?review=hunt')).status,200);
 await db.prepare("DELETE FROM submissions WHERE id='own'").run();assert.equal((await req('reviewer','/api/admin-submissions?challenge=active')).status,403);assert.equal((await req('reviewer','/api/photo/active-photo?review=hunt')).status,403,'photo route rechecks after own delivery is removed');
 assert.equal((await req('reviewer','/api/admin-submissions?challenge=future')).status,403);
 await db.prepare("DELETE FROM settings WHERE key='owner'").run();
 await db.prepare("UPDATE members SET admin=0 WHERE id='reviewer'").run();assert.equal((await req('reviewer','/api/admin-submissions?challenge=completed')).status,403);assert.equal((await req('reviewer','/api/photo/photo-0?review=hunt')).status,403);
 assert.equal((await review('reviewer',verdict)).status,403);
 console.log('PASS: signed admin access to all hunt participants; normal gallery boundary; own-delivery/end gate on list and image; future-word secrecy; blocked/invalid records; user filter and pagination; separate receipt/photo times; minimal audit and no-store; immediate role and own-delivery rechecks.');
}finally{await mf.dispose()}
