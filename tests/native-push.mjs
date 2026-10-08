import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare,Response:MFResponse}=wr('miniflare');
const messages=[];let ticket={status:'ok',id:'ticket'};
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{ADMIN_PIN:'9752',ADMIN_EMAIL:'owner@test.invalid',PUSH_SCHEDULER_SECRET:'test-secret'},cf:false,outboundService:async req=>{
assert.equal(req.url,'https://exp.host/--/api/v2/push/send');messages.push(await req.json());return MFResponse.json({data:ticket});}});
try{const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const post=(url,body,cookie)=>mf.dispatchFetch('https://example.test'+url,{method:'POST',headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});

// Native registration returns the login token in the body; browsers keep getting only the cookie.
const web=await post('/api/auth',{action:'register',ageConfirmed:true,privacyVersion:'2026-10-06.1',name:'Web',username:'web',pin:'123456',installed:true});assert.equal(web.status,200);assert.deepEqual(await web.json(),{ok:true});
const reg=await post('/api/auth',{action:'register',ageConfirmed:true,privacyVersion:'2026-10-06.1',name:'Nora',username:'nora',pin:'654321',installed:true,client:'native'});assert.equal(reg.status,200);const {token}=await reg.json();
assert.match(token,/^[0-9a-f-]{72}$/);assert(reg.headers.get('set-cookie').includes('hunt_login='+token));
const login=await post('/api/auth',{action:'login',name:'nora',pin:'654321',client:'native'});const second=(await login.json()).token;assert(second&&second!==token);
const cookie='hunt_login='+second;const state=await(await mf.dispatchFetch('https://example.test/api/hunt',{headers:{cookie}})).json();assert.equal(state.user.name,'Nora');
const viaBearer=await(await mf.dispatchFetch('https://example.test/api/hunt',{headers:{authorization:'Bearer '+second}})).json();assert.equal(viaBearer.user.name,'Nora');
assert.equal((await(await mf.dispatchFetch('https://example.test/api/hunt',{headers:{authorization:'Bearer '+token.replace(/.$/,c=>c==='0'?'1':'0')}})).json()).user,null);

// Device registration validates Expo tokens and stores them as provider=expo.
const expoToken='ExponentPushToken[abcdefghijklmnop]';
assert.equal((await post('/api/push',{action:'subscribe-native',token:'https://evil.example/'},cookie)).status,400);
const sub=await post('/api/push',{action:'subscribe-native',token:expoToken},cookie);assert.equal(sub.status,200);
const row=await db.prepare('SELECT * FROM push_subscriptions WHERE endpoint=?').bind(expoToken).first();assert.equal(row.provider,'expo');assert.equal(row.p256dh,'');
assert.equal((await post('/api/push',{action:'subscribe-native',token:expoToken},cookie)).status,200);assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,1);

// The existing test action goes out through Expo on the hunts channel.
const test=await post('/api/push',{action:'test',endpoint:expoToken},cookie);assert.equal(test.status,200,await test.clone().text());
assert.equal(messages.length,1);const [message]=messages;assert.equal(message.to,expoToken);assert.equal(message.channelId,'hunts');assert.equal(message.collapseId,'photo-hunt-test');assert.equal(message.data.url,'/');assert.equal(message.data.kind,'test');assert.equal(message.priority,'high');

// Another account signing in on the same phone takes the device over without the old queue.
const other=await post('/api/auth',{action:'login',name:'web',pin:'123456',client:'native'});const otherCookie='hunt_login='+(await other.json()).token;
// Real social dispatch must use distinct APNs collapse IDs of at most 64 bytes.
const recipient=row.user,actor=(await db.prepare("SELECT id FROM members WHERE username='web'").first()).id,now=Date.now();
await db.prepare('INSERT INTO seasons(id,name,start,end) VALUES (?,?,?,?)').bind('native-season','Native',now-20000,now-1000).run();
await db.prepare('INSERT INTO challenges(id,season,title,start,end,duration,created) VALUES (?,?,?,?,?,?,?)').bind('native-hunt','native-season','Test',now-10000,now-1000,9000,now-20000).run();
await db.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES (?,?,?,?,?,?)').bind('native-photo','native-hunt',recipient,'test',now-2000,1000).run();
await db.prepare('INSERT INTO groups(id,name,owner,created) VALUES (?,?,?,?)').bind('native-group','Native',recipient,now).run();
for(const user of [recipient,actor])await db.prepare('INSERT INTO group_members(group_id,user,joined) VALUES (?,?,?)').bind('native-group',user,now).run();
for(const kind of ['comments','reactions'])assert.equal((await post('/api/push',{action:'preferences',kind,enabled:true},cookie)).status,200);
for(const body of ['First comment','Second comment']){assert.equal((await post('/api/hunt',{action:'comment',id:'native-photo',body},otherCookie)).status,200);await db.prepare('UPDATE comments SET created=? WHERE user=?').bind(now-10000,actor).run();}
assert.equal((await post('/api/hunt',{action:'react',id:'native-photo',emoji:'❤️'},otherCookie)).status,200);
const jobs=(await db.prepare('SELECT id FROM social_push WHERE subscription=?').bind(row.id).all()).results;assert.equal(jobs.length,3);
const tick=await mf.dispatchFetch('https://example.test/api/push/tick',{method:'POST',headers:{'x-photo-hunt-scheduler-key':'test-secret'}});assert.equal(tick.status,200);assert.equal((await tick.json()).sent,3);
const social=messages.slice(1);assert.equal(social.length,3);assert.equal(new Set(social.map(m=>m.collapseId)).size,3);
for(const message of social){assert.equal(message.channelId,'social');assert.equal(message.data.kind,'social');assert.match(message.collapseId,/^[a-f0-9]{64}$/);assert(new TextEncoder().encode(message.tag).length>64);assert.equal(message.collapseId,require('node:crypto').createHash('sha256').update(message.tag).digest('hex'));}
assert.equal((await post('/api/push',{action:'subscribe-native',token:expoToken},otherCookie)).status,200);
const moved=await db.prepare('SELECT m.username FROM push_subscriptions p JOIN members m ON m.id=p.user WHERE p.endpoint=?').bind(expoToken).first();assert.equal(moved.username,'web');assert.notEqual((await db.prepare('SELECT id FROM push_subscriptions WHERE endpoint=?').bind(expoToken).first()).id,row.id);

// DeviceNotRegistered is treated like Web Push 410: the device is removed.
ticket={status:'error',message:'gone',details:{error:'DeviceNotRegistered'}};
await db.prepare("DELETE FROM settings WHERE key LIKE 'push_test:%'").run();
const gone=await post('/api/push',{action:'test',endpoint:expoToken},otherCookie);assert.equal(gone.status,400);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,0);

// Logout with the Expo token removes the device, as for web endpoints.
assert.equal((await post('/api/push',{action:'subscribe-native',token:expoToken},cookie)).status,200);
assert.equal((await post('/api/auth',{action:'logout',endpoint:expoToken},cookie)).status,200);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM push_subscriptions').first()).n,0);
const after=await(await mf.dispatchFetch('https://example.test/api/hunt',{headers:{cookie}})).json();assert.equal(after.user,null);
console.log('Native push and token login: OK');
}finally{await mf.dispose()}
