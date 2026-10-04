import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const wranglerRequire=createRequire(require.resolve('wrangler/package.json'));const {Miniflare}=wranglerRequire('miniflare');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',ADMIN_EMAIL:'owner@test.invalid'},cf:false});
try{
const db=await mf.getD1Database('DB');for(const migration of (await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort()){const sql=await readFile('drizzle/'+migration,'utf8');for(const statement of sql.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();}
const jars={},ids={};async function request(user,body,path='/api/hunt'){const h={};if(user&&jars[user])h.cookie=jars[user];if(body&&['pin','register','login','logout','set-pin'].includes(body.action))path='/api/auth';if(body&&!(body instanceof FormData))h['content-type']='application/json';let payload=body?JSON.stringify(body):undefined;if(body instanceof FormData){const encoded=new Response(body);h['content-type']=encoded.headers.get('content-type');payload=new Uint8Array(await encoded.arrayBuffer())}const r=await mf.dispatchFetch('https://test.invalid'+path,{method:body?'POST':'GET',headers:h,...(body?{body:payload}:{})});const set=r.headers.getSetCookie();if(set.length&&user)jars[user]=set.map(c=>c.split(';')[0]).join('; ');let data;try{data=await r.json()}catch{data=null}return {status:r.status,data}}
assert.equal((await request(null)).data.user,null);
assert.equal((await request('owner',{action:'pin',pin:'0000'})).status,403);
assert.equal((await request('owner',{action:'pin',pin:'9752'})).status,200);
assert.equal((await request('owner')).data.admin,true);
assert.equal((await request('missing',{action:'register',name:'No install',pin:'123456'})).status,400);
assert.equal((await request('guest',{action:'register',installed:true,name:'Testdeltaker',pin:'123456'})).status,200);
assert.equal((await request('guest')).data.user.status,'pending');
assert.equal((await request('guest',{action:'season',name:'Ikke tillatt'})).status,403);
ids.guest=(await request('guest')).data.user.id;
assert.equal((await request('other',{action:'login',name:'Testdeltaker',pin:'000000'})).status,403);
assert.equal((await request('other',{action:'register',installed:true,name:'TESTDELTAKER',pin:'111111'})).status,400);
assert.equal((await request('other',{action:'set-pin',id:ids.guest,pin:'999999'})).status,401);
assert.equal((await request('owner',{action:'member',id:ids.guest,status:'approved'})).status,400);
async function seedPush(id){await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(id,id,'https://fcm.googleapis.com/'+id,'key','auth',1,1).run()}
await seedPush(ids.guest);
assert.equal((await request('owner',{action:'member',id:ids.guest,status:'approved'})).status,200);
assert.equal((await request('owner',{action:'season',name:'Testsesong'})).status,200);
assert.equal((await request('owner',{action:'challenge',title:'Finn noe gult',minutes:60,mode:'now'})).status,200);
let d=(await request('guest')).data;const c=d.challenges[0];assert(c&&c.eligible&&!c.reveal);assert.equal(c.submissions.length,0);
const token=(await request('guest',{action:'camera',id:c.id})).data.token;assert(token);
// Seed a minimal JPEG payload to test authenticated R2 ingestion independently of camera hardware.
const bytes=new Uint8Array(120);bytes.set([255,216,255]);const form=new FormData();form.set('challenge',c.id);form.set('token',token);form.set('photo',new Blob([bytes],{type:'image/jpeg'}),'capture.jpg');assert.equal((await request('guest',form)).status,200);
d=(await request('guest')).data;assert(d.challenges[0].own);assert(d.challenges[0].reveal);const sid=d.challenges[0].own.id;
assert.equal((await request('guest',form)).status,400);
await request('viewer',{action:'register',installed:true,name:'Tilskuer',pin:'654321'});ids.viewer=(await request('viewer')).data.user.id;await seedPush(ids.viewer);await request('owner',{action:'member',id:ids.viewer,status:'approved'});
assert.equal((await request('viewer',null,'/api/photo/'+sid)).status,403);
assert.equal((await request(null,null,'/api/photo/'+sid)).status,401);
assert.equal((await request('guest',{action:'react',id:sid,emoji:'🔥'})).status,400);
assert.equal((await request('owner',{action:'end-challenge',id:c.id})).status,200);
assert.equal((await request('viewer',null,'/api/photo/'+sid)).status,200);
assert.equal((await request('guest',{action:'camera',id:c.id})).status,400);
d=(await request('guest')).data;assert.equal(d.leaderboard.find(m=>m.id===ids.guest).points,10);assert.equal(d.leaderboard.find(m=>m.id===ids.guest).wins,1);
assert.equal((await request('guest',{action:'react',id:sid,emoji:'🔥'})).status,200);
assert.equal((await request('owner',{action:'result',id:sid,seconds:0,valid:false,note:'Feil motiv'})).status,200);
assert.equal((await request('guest')).data.leaderboard.find(m=>m.id===ids.guest).points,0);
assert.equal((await request('owner',{action:'member',id:ids.viewer,status:'blocked'})).status,200);
assert.equal((await request('viewer',null,'/api/photo/'+sid)).status,403);
assert.equal((await request('owner',{action:'challenge',title:'Senere',minutes:30,mode:'schedule',start:new Date(Date.now()+3600000).toISOString()})).status,200);
assert.equal((await request('guest')).data.challenges.length,1);
// Reset preserves identity and results, revokes sessions, and never grants membership.
assert.equal((await request('owner',{action:'set-pin',id:ids.guest,pin:'987654'})).status,200);
assert.equal((await request('guest')).data.user,null);
assert.equal((await request('guest',{action:'login',name:'Testdeltaker',pin:'123456'})).status,403);
assert.equal((await request('guest',{action:'login',name:'testdeltaker',pin:'987654'})).status,200);
assert.equal((await request('guest')).data.user.id,ids.guest);
assert((await request('guest')).data.challenges[0].own);
assert.equal((await request('guest',{action:'logout'})).status,200);
assert.equal((await request('guest')).data.user,null);
// ChatGPT headers alone no longer authenticate anyone.
const forged=await mf.dispatchFetch('https://test.invalid/api/hunt',{headers:{'oai-authenticated-user-id':ids.guest,'oai-authenticated-user-email':'guest@test.invalid'}});
assert.equal((await forged.json()).user,null);
// Migrate an existing approved member without losing their ID.
await db.prepare("INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES ('legacy','Tidligere medlem','','approved',1,1,0)").run();
assert.equal((await request('new',{action:'register',installed:true,name:'Tidligere medlem',pin:'222222'})).status,400);
assert.equal((await request('owner',{action:'set-pin',id:'legacy',pin:'222222'})).status,200);
assert.equal((await request('legacy',{action:'login',name:'Tidligere medlem',pin:'222222'})).status,200);
assert.equal((await request('legacy')).data.user.id,'legacy');
const csrf=await mf.dispatchFetch('https://test.invalid/api/auth',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify({action:'register',installed:true,name:'Evil',pin:'123456'})});assert.equal(csrf.status,403);
for(let i=0;i<9;i++)await request('bad',{action:'login',name:'Brute force',pin:'000000'});
assert.equal((await request('bad',{action:'login',name:'Brute force',pin:'000000'})).status,429);
// Deletion cascades, blob removal, admin authorization, isolation and repeat safety.
const storage=await mf.getR2Bucket('BUCKET');
await db.prepare("INSERT INTO seasons(id,name,start,end) VALUES ('delete-season','Delete',1,2)").run();
for(const id of ['delete-one','delete-two']){
 await db.prepare('INSERT INTO challenges(id,season,title,start,end,duration,created) VALUES (?,?,?,?,?,?,?)').bind(id,'delete-season',id,1,2,1,1).run();
 await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid,note) VALUES (?,?,?,?,?,?,1,?)').bind(id,id,'legacy','photos/'+id,2,1,'').run();
 await storage.put('photos/'+id,'image');
 await db.prepare('INSERT INTO reactions(id,submission,user,emoji) VALUES (?,?,?,?)').bind(id,id,'legacy','🔥').run();
 await db.prepare('INSERT INTO captures(token,user,challenge,expires,used) VALUES (?,?,?,?,0)').bind(id,'legacy',id,9999999999999).run();
 await db.prepare('INSERT INTO push_deliveries(id,subscription,challenge,kind,created) VALUES (?,?,?,?,?)').bind(id,'sub',id,'start',1).run();
}
for(const action of ['delete-photo','delete-challenge','delete-season']){
 assert.equal((await request('legacy',{action,id:'delete-one'})).status,403);
 assert.equal((await request(null,{action,id:'delete-one'})).status,401);
}
assert.equal((await request('owner',{action:'delete-photo',id:'delete-one'})).status,200);
assert.equal(await storage.get('photos/delete-one'),null);
assert.equal(await db.prepare("SELECT * FROM reactions WHERE id='delete-one'").first(),null);
assert.equal(await db.prepare("SELECT * FROM captures WHERE token='delete-one'").first(),null);
assert(await db.prepare("SELECT * FROM challenges WHERE id='delete-one'").first());
assert(await storage.get('photos/delete-two'));
assert.equal((await request('owner',{action:'delete-challenge',id:'delete-one'})).status,200);
assert.equal(await db.prepare("SELECT * FROM push_deliveries WHERE id='delete-one'").first(),null);
assert.equal((await request('owner',{action:'delete-season',id:'delete-season'})).status,200);
for(const table of ['seasons','challenges','submissions','reactions','push_deliveries'])assert.equal(await db.prepare('SELECT * FROM '+table+' WHERE id=?').bind(table==='seasons'?'delete-season':'delete-two').first(),null);
assert.equal(await storage.get('photos/delete-two'),null);
assert(await db.prepare('SELECT * FROM submissions WHERE id=?').bind(sid).first(),'unrelated original photo survives');
assert.equal((await request('owner',{action:'delete-season',id:'delete-season'})).status,200);
assert.equal((await request('owner',{action:'delete-photo',id:sid})).status,200);
assert.equal((await request('legacy',null,'/api/photo/'+sid)).status,404);
assert.equal((await request('legacy')).data.leaderboard.find(m=>m.id===ids.guest).done,0);
console.log('PASS: admin-only deletion, cascades, R2 removal, score refresh, repeated deletion and unrelated data preservation.');
assert.equal((await request('owner',{action:'logout-admin'})).status,200);
assert.equal((await request('owner',{action:'season',name:'Låst'})).status,403);
console.log('PASS: authentication, local name/PIN login, secure sessions, legacy migration, rate limiting, CSRF, PIN reset, membership approvals, challenge release, camera token, R2 upload, duplicate prevention, hidden photos, deadlines, rankings, corrections, reactions, scheduling privacy and admin logout.');
}finally{await mf.dispose()}
