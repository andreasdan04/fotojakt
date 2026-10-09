import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false,outboundService:async()=>{throw Error('No external chat transfers expected')}});
const room='staff:judges',tokens={};
try{
 const db=await mf.getD1Database('DB'),now=Date.now();
 for(const file of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const [id,admin,role,signed,status] of [['owner',0,null,true,'approved'],['admin',1,null,true,'approved'],['judge',0,'judge',true,'approved'],['head',0,'head_judge',true,'approved'],['unsigned',0,'judge',false,'approved'],['player',0,null,false,'approved'],['blocked',0,'judge',true,'blocked']]){
  await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,?,1,1,?)').bind(id,id,'private@example.invalid',status,admin).run();
  tokens[id]=crypto.randomUUID();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(crypto.createHash('sha256').update(tokens[id]).digest('hex'),id,now+86400000).run();
  if(role)await db.prepare('INSERT INTO staff_roles(user,role,updated,actor) VALUES(?,?,?,?)').bind(id,role,now,'owner').run();
  if(signed)await seedStaffAcceptance(db,id,now);
 }
 await db.prepare("INSERT INTO settings(key,value) VALUES('owner','owner')").run();
 const req=async(user,url='/api/chat?room='+encodeURIComponent(room),body,headers={})=>mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:{...(user?{cookie:'hunt_login='+tokens[user]}:{}),...(body?{'content-type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 const send=(body,id=crypto.randomUUID(),extra={})=>({action:'send',room,body,id,...extra});
 for(const user of ['player','unsigned','blocked']){
  assert.equal((await req(user)).status,403);assert.equal((await req(user,undefined,send('No access'))).status,403);
  const summary=await(await req(user,'/api/chat?summary=1')).json();assert(!summary.groups?.some(g=>g.kind==='staff'));
 }
 assert.equal((await req(null)).status,401);
 for(const user of ['owner','admin','judge','head']){const view=await(await req(user)).json();assert.equal(view.name,'Dommerteam');assert(view.groups.some(g=>g.id===room&&g.kind==='staff'));assert.equal(view.canModerate,['owner','admin'].includes(user));assert(!JSON.stringify(view).includes('private@example.invalid'));}
 const body=send('Fortrolig vurdering');assert.equal((await req('judge',undefined,body)).status,200);assert.equal((await req('judge',undefined,body)).status,200,'retry deduplicates');assert.equal((await db.prepare('SELECT COUNT(*) n FROM chat_messages').first()).n,1);
 const view=await(await req('head')).json();assert.equal(view.messages[0].body,body.body);assert.equal(view.groups.find(g=>g.id===room).unread,1);
 const bearer=await req(null,undefined,undefined,{Authorization:'Bearer '+tokens.head});assert.equal(bearer.status,200,'native bearer uses same chat access');
 const publicView=await(await req('player','/api/chat?room=public')).json();assert(!JSON.stringify(publicView).includes(body.body));assert(!publicView.groups.some(g=>g.kind==='staff'));
 const inbox=await(await req('head','/api/notifications')).json();assert(inbox.items.some(n=>n.room===room&&n.message===body.id));assert(!(await(await req('player','/api/notifications')).json()).items.some(n=>n.room===room));
 assert.equal((await req('head',undefined,{action:'read',room,id:body.id})).status,200);assert.equal((await(await req('head')).json()).groups.find(g=>g.id===room).unread,0);assert((await(await req('judge')).json()).messages[0].readBy.some(r=>r.id==='head'));
 assert.equal((await req('head',undefined,{action:'react',room,id:body.id,emoji:'👍'})).status,200);assert.equal((await(await req('judge')).json()).messages[0].reactions[0].count,1);
 const reply=send('Enig i vurderingen',crypto.randomUUID(),{replyTo:body.id});assert.equal((await req('head',undefined,reply)).status,200);assert.equal((await(await req('judge')).json()).messages.at(-1).reply.body,body.body);
 assert.equal((await req('head',undefined,{action:'delete',room,id:body.id})).status,403,'judge cannot moderate others');
 const uploadId=crypto.randomUUID();const form=new FormData();form.set('room',room);form.set('id',uploadId);form.set('file',new File(['Fortrolig vedlegg'],'case.txt',{type:'text/plain'}));
 const encoded=new Request('https://test.invalid',{method:'POST',body:form});const uploaded=await mf.dispatchFetch('https://test.invalid/api/chat/attachments',{method:'POST',headers:{cookie:'hunt_login='+tokens.judge,'content-type':encoded.headers.get('content-type')},body:await encoded.arrayBuffer()});assert.equal(uploaded.status,200,await uploaded.clone().text());
 assert.equal((await req('player','/api/chat/attachments/'+uploadId)).status,403);assert.equal((await req('head','/api/chat/attachments/'+uploadId)).status,403,'unsent attachment belongs to author only');
 await db.prepare("DELETE FROM settings WHERE key='chat-rate:judge'").run();const fileMessage=send('Vedlegg',crypto.randomUUID(),{attachments:[uploadId]});assert.equal((await req('judge',undefined,fileMessage)).status,200);assert.equal((await req('head','/api/chat/attachments/'+uploadId)).status,200);
 assert.equal((await req('head',undefined,send('Wrong origin'),{origin:'https://other.invalid'})).status,403);
 await db.prepare("DELETE FROM staff_roles WHERE user='judge'").run();
 assert.equal((await req('judge')).status,403);assert.equal((await req('judge',undefined,body)).status,403,'revoked role cannot replay an old send');assert.equal((await req('judge','/api/chat/attachments/'+uploadId)).status,403);assert(!(await(await req('judge','/api/notifications')).json()).items.some(n=>n.room===room));
 const stillVisible=await(await req('head')).json();assert(stillVisible.messages.some(m=>m.id===body.id),'history survives role removal');assert(!stillVisible.groups.find(g=>g.id===room).lastMessage.readBy.some(r=>r.id==='judge'),'revoked members are excluded from current reader list');
 assert.equal((await req('admin',undefined,{action:'delete',room,id:fileMessage.id})).status,200,'administrator moderates team chat');assert.equal((await req('head','/api/chat/attachments/'+uploadId)).status,404,'deleted attachment no longer accessible');
 await db.prepare("INSERT INTO settings(key,value) VALUES('staff-agreement-current',?)").bind(JSON.stringify({version:'new',text:'New declaration',requiredAt:now+1})).run();assert.equal((await req('head')).status,403,'material declaration update requires new acceptance');
 console.log('PASS: signed owner/admin/head judge/judge team chat; player/unsigned/blocked exclusion; native bearer; private summaries/inbox/files; replies, reactions, read receipts, deduplicated sends; moderation limits; role revocation and declaration updates; preserved history.');
}finally{await mf.dispose()}
