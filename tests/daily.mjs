import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
let aiMode='good',calls=0;const words=['kopp','sykkel','stein','sko','lampe','hund'];
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',OPENAI_API_KEY:'fake-test-key'},cf:false,outboundService:async req=>{assert.equal(req.url,'https://api.openai.com/v1/chat/completions');assert.equal(req.headers.get('authorization'),'Bearer fake-test-key');calls++;const payload=await req.json();assert(payload.messages[0].content.includes('Vestvågøy'));assert.equal(payload.store,false);const dates=JSON.parse(payload.messages[1].content).dates;return new MFResponse(JSON.stringify({choices:[{message:{content:JSON.stringify({words:aiMode==='bad'?['to ord']:aiMode==='english'?['cup','bicycle','stone']:words.slice(0,dates.length)})}}]}),{status:aiMode==='quota'?429:200})}});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now(),headers={};for(const user of ['admin','early','late','pending']){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,?)').bind(user,user,'',user==='pending'?'pending':'approved',now-10000,now-5000,user==='admin'?1:0).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update(user).digest('hex'),user,now+86400000).run();headers[user]={cookie:'hunt_login='+user+(user==='admin'?'; hunt_admin=admin':''),'content-type':'application/json'};await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(user,user,'https://fcm.googleapis.com/'+user,'k','a',1,1).run();}
await db.prepare('INSERT INTO sessions(token,user,expires) VALUES (?,?,?)').bind(crypto.createHash('sha256').update('admin').digest('hex'),'admin',now+86400000).run();
await seedStaffAcceptance(db,'admin',now);await db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('owner',?)").bind('admin').run();
await db.prepare("INSERT OR IGNORE INTO rules_acceptances(user_id,rules_version,accepted_at) SELECT id,'2026-10-07.1',1 FROM members").run();
await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('test-group','Test','admin',1)").run();await db.prepare("INSERT INTO group_members(group_id,user,joined) SELECT 'test-group',id,1 FROM members").run();
async function req(user,body,url='/api/hunt'){const h={...headers[user]};let data;if(body instanceof FormData){const encoded=new Response(body);h['content-type']=encoded.headers.get('content-type');data=new Uint8Array(await encoded.arrayBuffer())}else data=body?JSON.stringify(body):undefined;const r=await mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:h,...(data?{body:data}:{})});return {status:r.status,data:await r.json()}}
const tomorrow=new Date(now+86400000).toISOString().slice(0,10),last=new Date(now+3*86400000).toISOString().slice(0,10);
assert.equal((await req('early',{action:'album',name:'No',first:tomorrow,last})).status,403);
let result=await req('admin',{action:'album',name:'Familiealbum',first:tomorrow,last});assert.equal(result.status,200,JSON.stringify(result));assert.equal(calls,1);assert(!JSON.stringify(result).includes('kopp'));const album=result.data.id;
const days=(await db.prepare('SELECT * FROM challenges WHERE season=? ORDER BY start').bind(album).all()).results;assert.equal(days.length,6);for(const day of days){assert.equal(new Intl.DateTimeFormat('nb-NO',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(day.start),day.slot===2?'14':'06');assert.equal(new Intl.DateTimeFormat('nb-NO',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(day.end),day.slot===2?'00':'17');}
assert.equal((await req('admin',{action:'album',name:'Overlap',first:tomorrow,last})).status,400);assert.equal(calls,1);
let data=(await req('admin')).data;assert(!JSON.stringify(data.challenges).includes('kopp'),'even admin cannot peek at future words');
assert.equal((await req('early',{action:'start-daily',id:days[0].id})).status,400);
await db.prepare('UPDATE challenges SET start=?,end=? WHERE id=?').bind(now-3600000,now+3600000,days[0].id).run();
assert.equal((await req('pending',{action:'start-daily',id:days[0].id})).status,403);
data=(await req('early')).data;assert.equal(data.challenges[0].title,'Dagens hemmelige ord');assert.equal((await req('early',{action:'camera',id:days[0].id})).status,400);
const start=(await req('early',{action:'start-daily',id:days[0].id})).data;assert.equal(start.title,'kopp');assert.equal((await req('early',{action:'start-daily',id:days[0].id})).data.started,start.started);
assert.equal((await req('early')).data.challenges[0].started,start.started);assert.equal((await req('late')).data.challenges[0].title,'Dagens hemmelige ord');
await db.prepare('UPDATE starts SET started=? WHERE user=?').bind(Date.now()-7200000,'early').run();
const token=(await req('early',{action:'camera',id:days[0].id})).data.token;assert(token);const bytes=new Uint8Array(await readFile('tests/fixtures/metadata.jpg'));const f=new FormData();f.set('challenge',days[0].id);f.set('token',token);f.set('photo',new Blob([bytes],{type:'image/jpeg'}),'capture.jpg');
assert.equal((await req('early',f)).status,400,'shutter required');assert.equal((await req('late',{action:'taken',token})).status,400);
const taken=(await req('early',{action:'taken',token})).data;assert(taken.elapsed>=7200000);const delayedShot=taken.taken-600000;await db.prepare('UPDATE captures SET taken=? WHERE token=?').bind(delayedShot,token).run();assert.equal((await db.prepare('SELECT expires FROM captures WHERE token=?').bind(token).first()).expires,now+3600000+86400000);const submitted=await req('early',f);assert.equal(submitted.status,200,JSON.stringify(submitted));assert.equal(submitted.data.elapsed,taken.elapsed-600000,'upload more than five minutes after shutter must work before midnight');
assert.equal((await req('early',f)).status,200,'same delivery is idempotent');assert.equal((await req('late')).data.challenges[0].submissions.length,0);
const photoId=(await db.prepare('SELECT id FROM submissions WHERE user=?').bind('early').first()).id;
assert.equal((await req('early',{action:'comment',id:photoId,body:'Flott bilde!'})).status,200);
assert.equal((await req('early',{action:'react',id:photoId,emoji:'❤️'})).status,200);
assert.equal((await req('late',{action:'comment',id:photoId,body:'For tidlig'})).status,403);
assert.equal((await req('late',{action:'react',id:photoId,emoji:'❤️'})).status,403);
assert.equal((await req('pending',{action:'comment',id:photoId,body:'Ingen tilgang'})).status,403);
assert.equal((await req('late')).data.comments.length,0);
assert.equal((await req('late')).data.reactions.length,0);
assert.equal((await req('early')).data.comments[0].body,'Flott bilde!');
assert.equal((await req('early')).data.reactions[0].count,1);
assert.equal((await req('early')).data.badges.length,1,'participation per season');assert.equal((await req('early')).data.badges[0].place,null,'no medal before season end');
const avatarForm=new FormData();avatarForm.set('photo',new Blob([bytes],{type:'image/jpeg'}),'avatar.jpg');avatarForm.set('user','admin');
assert.equal((await req('pending',avatarForm,'/api/avatar')).status,403);
assert.equal((await req('early',avatarForm,'/api/avatar')).status,200);
assert(await db.prepare('SELECT key FROM avatars WHERE user=?').bind('early').first());assert.equal(await db.prepare('SELECT key FROM avatars WHERE user=?').bind('admin').first(),null,'cannot update another profile');
const oldAvatar=(await db.prepare('SELECT key FROM avatars WHERE user=?').bind('early').first()).key;
assert.equal((await req('early',avatarForm,'/api/avatar')).status,200);assert.equal(await (await mf.getR2Bucket('BUCKET')).get(oldAvatar),null,'old avatar removed');
assert.equal((await mf.dispatchFetch('https://test.invalid/api/avatar/early',{headers:headers.late})).status,200);
assert.equal((await mf.dispatchFetch('https://test.invalid/api/avatar/early',{headers:headers.pending})).status,403);
const badAvatar=new FormData();badAvatar.set('photo',new Blob(['<svg></svg>'],{type:'image/svg+xml'}),'bad.svg');assert.equal((await req('early',badAvatar,'/api/avatar')).status,400);

assert.equal((await req('early')).data.reactions[0].users[0].id,'early');
let profile=await req('late',undefined,'/api/hunt?profile=early');assert.equal(profile.status,200);assert.equal(profile.data.photos.length,0);assert.equal(profile.data.achievements.badges.filter(b=>b.earned).length,0,'hidden active submission cannot leak achievements');assert.equal(profile.data.reactions.length,0);assert.equal(profile.data.comments.length,0);
profile=await req('early',undefined,'/api/hunt?profile=early');assert.equal(profile.data.photos.length,1);assert(profile.data.achievements.badges.find(b=>b.id==='first-photo').earned);assert.equal(profile.data.reactions[0].users[0].name,'early');assert(!('key' in profile.data.photos[0]));assert(!('email' in profile.data.profile));
assert(!(await req('pending',undefined,'/api/hunt?profile=early')).data.photos);

const commentId=(await req('early')).data.comments[0].id;
assert.equal((await req('late',{action:'delete-comment',id:commentId})).status,403);
assert.equal((await req('early',{action:'comment',id:photoId,body:' '})).status,400);
const late=(await req('late',{action:'start-daily',id:days[0].id})).data;assert(late.started>start.started);assert.equal(late.title,'kopp');
const lateToken=(await req('late',{action:'camera',id:days[0].id})).data.token;
const firstShot=(await req('late',{action:'taken',token:lateToken})).data;
await db.prepare('UPDATE captures SET taken=? WHERE token=?').bind(firstShot.taken-2000,lateToken).run();
const retake=(await req('late',{action:'taken',token:lateToken})).data;assert(retake.taken>=firstShot.taken);
await db.prepare('UPDATE challenges SET end=? WHERE id=?').bind(Date.now()-1,days[0].id).run();
assert.equal((await req('late',{action:'taken',token:lateToken})).status,400);
assert.equal((await req('late',{action:'start-daily',id:days[0].id})).status,400);
const lf=new FormData();lf.set('challenge',days[0].id);lf.set('token',lateToken);lf.set('photo',new Blob([bytes],{type:'image/jpeg'}),'late.jpg');
assert.equal((await req('late',lf)).status,400,'even a recent valid photo cannot be submitted after midnight');
assert.equal((await req('late',{action:'comment',id:photoId,body:'Nå er dagen ferdig!'})).status,200);
assert.equal((await req('late')).data.comments.length,2);
let badges=(await req('early')).data.badges;assert.equal(badges.length,1);assert.equal(badges[0].title,'Familiealbum');assert.equal(badges[0].place,null,'daily finish does not finish season');
await db.prepare('UPDATE seasons SET end=? WHERE id=?').bind(Date.now(),album).run();assert.equal((await req('early')).data.badges[0].place,1,'season medal uses leaderboard');
await db.prepare('UPDATE submissions SET valid=0 WHERE id=?').bind(photoId).run();assert.equal((await req('early')).data.badges[0].place,null);
await db.prepare('UPDATE submissions SET valid=1 WHERE id=?').bind(photoId).run();await db.prepare('UPDATE seasons SET end=NULL WHERE id=?').bind(album).run();
profile=await req('late',undefined,'/api/hunt?profile=early');assert.equal(profile.data.photos.length,1);assert.equal(profile.data.comments.length,2);

assert.equal((await req('early',{action:'react',id:photoId,emoji:'❤️'})).status,200);
assert.equal((await req('early')).data.reactions.length,0);
assert.equal((await req('early',{action:'delete-comment',id:commentId})).status,200);
// Failure does not leave a partial album. DST days use Oslo local clock.
await req('admin',{action:'delete-season',id:album});assert.equal((await db.prepare('SELECT COUNT(*) n FROM starts').first()).n,0);assert.equal((await db.prepare('SELECT COUNT(*) n FROM comments').first()).n,0);
for(const mode of ['bad','english']){aiMode=mode;const repaired=await req('admin',{action:'album',name:'Repair',first:tomorrow,last});assert.equal(repaired.status,200);await req('admin',{action:'delete-season',id:repaired.data.id});}
aiMode='quota';assert.equal((await req('admin',{action:'album',name:'Quota',first:tomorrow,last})).status,502);
aiMode='good';result=await req('admin',{action:'album',name:'DST',first:'2027-03-27',last:'2027-03-29'});assert.equal(result.status,200);const dst=(await db.prepare('SELECT start FROM challenges ORDER BY start').all()).results;assert.equal(new Date(dst[0].start).toISOString(),'2027-03-27T05:00:00.000Z');assert.equal(new Date(dst[2].start).toISOString(),'2027-03-28T04:00:00.000Z');
const month=await req('admin',{action:'album',name:'Full month',first:'2027-04-01',last:'2027-04-30'});assert.equal(month.status,200);assert.equal(month.data.days,30);
const full=await req('admin',{action:'album',name:'31 days',first:'2027-05-01',last:'2027-05-31'});assert.equal(full.status,200);assert.equal(full.data.days,31);
assert.equal((await req('admin',{action:'album',name:'Too long',first:'2027-06-01',last:'2027-07-02'})).status,400);
console.log('PASS: AI contract/failures, atomic albums, duplicate dates, Oslo 06:00/14:00 and DST, secret words, independent immutable starts, shutter timing, ownership, upload timing, midnight boundaries and deletion.');
}finally{await mf.dispose()}
