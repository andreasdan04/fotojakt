import {signature} from './helpers/staff.mjs';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
let outbound=0;
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',PUSH_SCHEDULER_SECRET:'test-secret',OPENAI_API_KEY:'synthetic-key'},cf:false,unsafeTriggerHandlers:true,outboundService:async()=>{outbound++;throw Error('Unexpected external data transfer')}});
try{
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('BUCKET');for(const file of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
 const jars={},ids={},tokens={};async function req(who,url,body){const h={...(jars[who]?{cookie:jars[who]}:{})};let payload;if(body instanceof FormData){const enc=new Response(body);h['content-type']=enc.headers.get('content-type');payload=new Uint8Array(await enc.arrayBuffer())}else if(body){h['content-type']='application/json';payload=JSON.stringify(body)}const r=await mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:h,...(payload?{body:payload}:{})});if(r.headers.getSetCookie().length&&who)jars[who]=r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');return r;}
 assert.equal((await req(null,'/personvern')).status,200);
 assert.equal((await req('a','/api/auth',{action:'register',name:'A',username:'alice',pin:'123456',installed:true})).status,400,'old clients must confirm age and read policy before registration');
 for(const [who,name] of [['a','alice'],['b','bob'],['c','carol']]){const r=await req(who,'/api/auth',{action:'register',name,username:name,pin:'123456',installed:true,ageConfirmed:true,privacyVersion:'2026-10-06.1',client:'native'});assert.equal(r.status,200);tokens[who]=(await r.json()).token;ids[who]=(await(await req(who,'/api/hunt')).json()).user.id;await db.prepare('UPDATE members SET approved=1 WHERE id=?').bind(ids[who]).run();}
 const native=await mf.dispatchFetch('https://test.invalid/api/privacy',{headers:{authorization:'Bearer '+tokens.a}});assert.equal(native.status,200);assert.equal((await native.json()).preferences.analytics,false);
 await req('a','/api/usage',{event:'hunt'});assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_daily').first()).n,0);
 for(const who of ['a','b'])assert.equal((await req(who,'/api/rules',{rules_version:'2026-10-07.1',accepted:true})).status,200);
 assert.equal((await req('a','/api/privacy',{action:'preferences',analytics:true,pushPreview:false})).status,200);await req('a','/api/usage',{event:'hunt'});assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_daily').first()).n,2);
 await req('a','/api/privacy',{action:'preferences',analytics:false,pushPreview:false});assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_daily').first()).n,0);
 const now=Date.now();await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('g','Synthetic Group',?,?)").bind(ids.a,now).run();for(const who of ['a','b'])await db.prepare("INSERT INTO group_members(group_id,user,joined) VALUES('g',?,?)").bind(ids[who],now).run();
 const privateId=crypto.randomUUID();assert.equal((await req('a','/api/chat',{action:'send',room:'g',id:privateId,body:'Synthetic private content'})).status,200);assert.equal(await db.prepare('SELECT * FROM chat_reviews WHERE message=?').bind(privateId).first(),null,'private content is not queued for AI');
 assert.equal((await req('b','/api/chat',{action:'report',room:'g',id:privateId})).status,200);assert.equal((await db.prepare('SELECT status FROM chat_reviews WHERE message=?').bind(privateId).first()).status,'manual');
 await db.prepare("DELETE FROM settings WHERE key LIKE 'chat-rate:%'").run();
 const publicId=crypto.randomUUID();await req('a','/api/chat',{action:'send',room:'public',id:publicId,body:'Synthetic public content'});assert.equal(await db.prepare('SELECT status FROM chat_reviews WHERE message=?').bind(publicId).first(),null,'clean public text is not queued for AI');
 assert.equal((await req('c','/api/chat?room=g')).status,403);
 // A JPEG with known identity/GPS metadata and appended bytes must be sanitized at the API boundary.
 const jpeg=await readFile('tests/fixtures/metadata.jpg'),form=new FormData();form.set('photo',new Blob([jpeg],{type:'image/jpeg'}),'avatar.jpg');assert.equal((await req('a','/api/avatar',form)).status,200);const avatar=await db.prepare('SELECT key FROM avatars WHERE user=?').bind(ids.a).first(),saved=Buffer.from(await(await bucket.get(avatar.key)).arrayBuffer());assert(!saved.includes(Buffer.from('GPS:')));assert(!saved.includes(Buffer.from('Exif')));assert(!saved.includes(Buffer.from('PRIVATE TRAILER')));assert.deepEqual([...saved.subarray(-2)],[255,217]);
 const invalid=new FormData();invalid.set('photo',new Blob([new Uint8Array([255,216,255,...Array(120).fill(0)])],{type:'image/jpeg'}),'bad.jpg');assert.equal((await req('a','/api/avatar',invalid)).status,400,'malformed image containers rejected');
 await db.prepare("INSERT INTO seasons(id,name,start) VALUES('season','Test',1)").run();await db.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created) VALUES('old','season','Test',1,2,1,1)").run();await db.prepare("INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES('photo','old',?,'photos/test.jpg',?,1)").bind(ids.a,now).run();await bucket.put('photos/test.jpg',saved);
 await new Promise(r=>setTimeout(r,1100));const share=crypto.randomUUID();assert.equal((await req('b','/api/chat',{action:'send',room:'public',id:crypto.randomUUID(),photo:'photo',body:''})).status,403,'friends cannot reshare another person photo');assert.equal((await req('a','/api/chat',{action:'send',room:'public',id:share,photo:'photo',body:''})).status,200);assert.equal((await req('c','/api/chat/photo/'+share)).status,200,'owner explicitly expands audience');
 const profile=(await(await req('b','/api/hunt?profile='+ids.a)).json()).profile;assert.equal(profile.settings.theme,undefined);assert.equal(profile.friendCount,null);
 // Blocked accounts retain authenticated rights endpoints and can reauthenticate using their PIN.
 await db.prepare("UPDATE members SET status='blocked' WHERE id=?").bind(ids.b).run();assert.equal((await req('b','/api/privacy/export',{pin:'000000'})).status,403);const exp=await req('b','/api/privacy/export',{pin:'123456'});assert.equal(exp.status,200,await exp.clone().text());const exported=await exp.json();assert.equal(exported.account.id,ids.b);assert(!JSON.stringify(exported).includes(tokens.b));assert.equal(exported.messages.length,0,'other users messages excluded');assert.equal(exported.rulesAcceptances.length,1);assert.equal(exported.rulesAcceptances[0].user_id,ids.b);
 assert.equal((await req('a','/api/privacy/delete',{pin:'123456',confirm:'SLETT'})).status,409,'owned group must be transferred first');await db.prepare("UPDATE members SET status='approved' WHERE id=?").bind(ids.b).run();assert.equal((await req('a','/api/privacy',{action:'transfer-group',group:'g',user:ids.b})).status,200);
 await req('a','/api/push',{action:'subscribe-native',token:'ExpoPushToken[abcdefghijklmnop]'});const sub=await db.prepare('SELECT id FROM push_subscriptions WHERE user=?').bind(ids.a).first();await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('push_test:'+sub.id,'1').run();await db.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('push_disabled:'+ids.a,'0').run();await db.prepare("INSERT INTO difficulty_polls(id,challenge,word,revision,actor,created,deadline) VALUES('poll','old','word',0,?,1,2)").bind(ids.a).run();
 assert.equal((await req('a','/api/privacy/delete',{pin:'123456',confirm:'SLETT'})).status,200);assert.equal(await db.prepare('SELECT id FROM members WHERE id=?').bind(ids.a).first(),null);assert.equal(await bucket.get(avatar.key),null);assert.equal(await bucket.get('photos/test.jpg'),null);assert.equal((await db.prepare("SELECT COUNT(*) n FROM settings WHERE key IN(?,?,?,?)").bind('privacy:'+ids.a,'age:'+ids.a,'push_disabled:'+ids.a,'push_test:'+sub.id).first()).n,0);assert.equal((await db.prepare("SELECT actor FROM difficulty_polls WHERE id='poll'").first()).actor,'deleted');assert.equal((await db.prepare('SELECT COUNT(*) n FROM rules_acceptances WHERE user_id=?').bind(ids.a).first()).n,0);
 assert.equal((await req('owner','/api/auth',{action:'pin',pin:'9752'})).status,200);const adminCookie=jars.owner.match(/hunt_admin=([^;]+)/)[1];assert(await db.prepare('SELECT user FROM sessions WHERE token=?').bind(crypto.createHash('sha256').update(adminCookie).digest('hex')).first());assert.equal(await db.prepare('SELECT user FROM sessions WHERE token=?').bind(adminCookie).first(),null);
 // Every administrator, including the owner, is gated server-side until acceptance.
 assert.equal((await req('owner','/api/usage')).status,403);assert.equal((await req('owner','/api/chat/moderation')).status,403);
 const agreement=(await(await req('owner','/api/admin-access')).json());assert.equal(agreement.accepted,false);assert.equal(agreement.members,undefined);
 const accept={action:'accept',version:agreement.version,accepted:true,name:'Synthetic Owner',email:'owner@test.invalid',address:'Synthetic Street 1, 0000 Test',signature};
 assert.equal((await req('owner','/api/admin-access',{...accept,signature:'Wrong Name'})).status,400);
 assert.equal((await req('owner','/api/admin-access',accept)).status,200);
 assert.equal((await req('owner','/api/usage?days=90')).status,200);
 assert.equal((await req('c','/api/admin-access')).status,403,'ordinary accounts cannot read admin identity records');
 assert.equal((await req('owner','/api/admin-access',{action:'role',id:ids.c,enabled:true})).status,200);
 assert.equal((await req('c','/api/privacy')).status,401,'grant revokes existing player sessions');
 assert.equal((await req('c','/api/auth',{action:'login',name:'carol',pin:'123456'})).status,200);
 assert.equal((await req('c','/api/usage')).status,403,'assigned role alone is insufficient');
 const stateBefore=(await(await req('c','/api/hunt')).json());assert.equal(stateBefore.admin,false);assert.equal(stateBefore.members,undefined);assert.equal(stateBefore.adminAccess.session,true);
 assert.equal((await req('c','/api/admin-access',{...accept,name:'Synthetic Carol',signature,email:'carol@test.invalid'})).status,200);
 assert.equal((await req('c','/api/chat/moderation')).status,200,'accepted administrators can evaluate cases');
 assert.equal((await req('c','/api/admin-access',{action:'role',id:ids.b,enabled:true})).status,403,'only owner can grant roles');
 assert.equal((await req('c','/api/admin-access?agreement='+stateBefore.adminAccess.isOwner)).status,403,'other identity records are owner-only');
 assert(Array.isArray((await(await req('c','/api/admin-access')).json()).members));
 const carolRecord=await(await req('owner','/api/admin-access?agreement='+ids.c)).json();assert.equal(carolRecord.records[0].name,'Synthetic Carol');assert.deepEqual(carolRecord.records[0].signature,signature);assert.equal(carolRecord.records[0].email,undefined);
 assert.equal((await req('owner','/api/admin-access',{action:'role',id:ids.c,enabled:false})).status,200);
 assert.equal((await req('c','/api/chat/moderation')).status,401,'revocation immediately invalidates old sessions');
 assert.equal((await req('c','/api/auth',{action:'login',name:'carol',pin:'123456'})).status,200);
 assert.equal((await req('c','/api/admin-access')).status,403);
 const ownerId=(await db.prepare("SELECT value FROM settings WHERE key='owner'").first()).value;
 assert.equal((await req('owner','/api/admin-access',{action:'role',id:ownerId,enabled:false})).status,403,'owner cannot revoke itself');
 await db.prepare("INSERT INTO challenges(id,season,title,details,start,end,duration,created) VALUES('secret-lightning','season','SYNTHETIC SECRET WORD','SYNTHETIC SECRET DESCRIPTION',?,?,1200000,1)").bind(now+3600000,now+4800000).run();
 await db.prepare("INSERT INTO game_hunts(challenge,week,lightning) VALUES('secret-lightning','synthetic-week',1)").run();
 const ownerState=await(await req('owner','/api/hunt?season=season')).json(),hidden=ownerState.challenges.find(c=>c.id==='secret-lightning');assert(hidden);assert.equal(hidden.title,'Hemmelige lynjaktord');assert(!JSON.stringify(ownerState).includes('SYNTHETIC SECRET WORD'));assert(!JSON.stringify(ownerState).includes('SYNTHETIC SECRET DESCRIPTION'));
 assert.equal((await req('owner','/api/auth',{action:'admin-password',password:'Test-passphrase-2026!'})).status,200);assert.equal((await req('oldowner','/api/auth',{action:'pin',pin:'9752'})).status,403);assert.equal((await req('owner','/api/auth',{action:'pin',password:'Test-passphrase-2026!'})).status,200);
 const stats=await(await req('owner','/api/usage')).json();assert.deepEqual(stats.users,[]);assert.equal(stats.suppressed,false);
 // Retention executes on a Worker scheduled event, independently of web sessions and push keys.
 await db.prepare("INSERT INTO chat_messages(id,room,user,body,created) VALUES('expired','public',?,'old synthetic text',1)").bind(ids.c).run();const day=86400000;
 for(const [id,age] of [['keep-chat',200],['expire-chat',366]])await db.prepare('INSERT INTO chat_messages(id,room,user,body,created) VALUES(?,?,?,?,?)').bind(id,'public',ids.c,'synthetic retention fixture',Date.now()-age*day).run();
 for(const [id,age] of [['keep-photo',500],['expire-photo',731]]){await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES(?,?,?,?,?,?)').bind(id,'old',id==='keep-photo'?ids.c:ids.b,'photos/'+id+'.jpg',Date.now()-age*day,1).run();await bucket.put('photos/'+id+'.jpg',saved);}
 await req('c','/api/privacy',{action:'preferences',analytics:true,pushPreview:false});
 for(const age of [60,91])await db.prepare("INSERT INTO usage_daily(day,user,event,count) VALUES(?,?,'visit',1)").bind(new Date(Date.now()-age*day).toISOString().slice(0,10),ids.c).run();
 const result=await mf.dispatchFetch('http://localhost/cdn-cgi/handler/scheduled?cron=17+*+*+*+*');
 assert(await db.prepare("SELECT id FROM chat_messages WHERE id='keep-chat'").first());assert.equal(await db.prepare("SELECT id FROM chat_messages WHERE id='expire-chat'").first(),null);
 assert(await db.prepare("SELECT id FROM submissions WHERE id='keep-photo'").first());assert.equal(await db.prepare("SELECT id FROM submissions WHERE id='expire-photo'").first(),null);assert(await bucket.get('photos/keep-photo.jpg'));assert.equal(await bucket.get('photos/expire-photo.jpg'),null);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_daily WHERE user=?').bind(ids.c).first()).n,1,'60-day analytics kept and 91-day analytics removed');
 await req('c','/api/privacy',{action:'preferences',analytics:false,pushPreview:false});assert.equal((await db.prepare('SELECT COUNT(*) n FROM usage_daily WHERE user=?').bind(ids.c).first()).n,0,'withdrawal deletes retained analytics immediately');
 assert.equal(result.status,200);assert.equal(await db.prepare("SELECT id FROM chat_messages WHERE id='expired'").first(),null);assert(await db.prepare("SELECT value FROM settings WHERE key='privacy-cleanup-status'").first());assert.equal(outbound,0,'no external AI transfer without operator approval');
 console.log('PASS: policy and age gate; native bearer access; server consent and withdrawal; private chat moderation boundary; owner-only sharing; image metadata stripping; blocked-account export; group transfer; account data-root deletion; hashed admin sessions and password migration; real aggregate visibility; independent retention.');
}finally{await mf.dispose();}
