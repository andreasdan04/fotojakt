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
assert.equal((await request('guest',{action:'register',installed:true,name:'Testdeltaker',username:'testdeltaker',pin:'123456'})).status,200);
assert.equal((await request('guest')).data.user.status,'approved');
assert.equal((await request('guest',{action:'season',name:'Ikke tillatt'})).status,403);
ids.guest=(await request('guest')).data.user.id;
assert.equal((await request('other',{action:'login',name:'Testdeltaker',pin:'000000'})).status,403);
assert.equal((await request('other',{action:'register',installed:true,name:'TESTDELTAKER',username:'testdeltaker',pin:'111111'})).status,400);
assert.equal((await request('other',{action:'set-pin',id:ids.guest,pin:'999999'})).status,401);
assert.equal((await request('owner',{action:'member',id:ids.guest,status:'approved'})).status,200);
async function seedPush(id){await db.prepare('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?)').bind(id,id,'https://fcm.googleapis.com/'+id,'key','auth',1,1).run()}
await seedPush(ids.guest);
assert.equal((await request('owner',{action:'member',id:ids.guest,status:'approved'})).status,200);
assert.equal((await request('owner',{action:'season',name:'Testsesong'})).status,200);
assert.equal((await request('owner',{action:'challenge',title:'Finn noe gult',minutes:60,mode:'now'})).status,200);
let d=(await request('guest')).data;const c=d.challenges[0];assert(c&&c.eligible&&!c.reveal);assert.equal(c.submissions.length,0);

if(!d.seasonWelcome){
assert.equal(d.seasonWelcome,null,'No welcome before the morning release');
const hour=Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(Date.now()));
assert(hour<7||Date.now()<Date.parse('2026-10-01T05:00:00Z')||Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(d.season.start))>=7);
console.log('Season welcome stays hidden until the next 07:00 release');
}else{
assert.equal(d.seasonWelcome.name,'Testsesong');
assert.equal(d.seasonWelcome.previous,null);
await db.prepare('INSERT INTO submissions (id,challenge,user,key,submitted,elapsed,valid,note) VALUES (?,?,?,?,?,?,1,?)').bind('winner-photo',c.id,ids.guest,'test',Date.now()-1000,1500,'').run();
await db.prepare('UPDATE challenges SET end=? WHERE id=?').bind(Date.now()-1,c.id).run();
await db.prepare('UPDATE seasons SET end=? WHERE id=?').bind(Date.now()-1,d.season.id).run();
await request('owner',{action:'season',name:'Ny fotojakt'});
const fresh=(await request('guest')).data;
assert.equal(fresh.seasonWelcome.name,'Ny fotojakt');
assert.equal(fresh.seasonWelcome.previous.winner.name,'Testdeltaker');
assert.equal(fresh.seasonWelcome.previous.winner.points,10);
const archived=(await request('guest',null,'/api/hunt?season='+d.season.id)).data;
assert.equal(archived.seasonWelcome.id,fresh.seasonWelcome.id);
console.log('Season welcome: current season, previous winner, points and archive selection passed');
}
}finally{await mf.dispose()}
