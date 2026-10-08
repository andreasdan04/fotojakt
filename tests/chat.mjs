import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare');
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
try{
const db=await mf.getD1Database('DB');for(const migration of(await readdir('drizzle')).filter(p=>p.endsWith('.sql')).sort())for(const stmt of(await readFile('drizzle/'+migration,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(stmt).run();
const now=Date.now();for(const[id,status,isAdmin]of[['owner','approved',1],['alice','approved',0],['bob','approved',0],['outsider','approved',0],['pending','pending',0],['blocked','blocked',0]]){await db.prepare('INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,?,1,1,?)').bind(id,id,'',status,isAdmin).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(crypto.createHash('sha256').update(id).digest('hex'),id,now+86400000).run()}
await db.prepare("INSERT INTO sessions(token,user,expires) VALUES('64f46a7526a186d2346552453ae478ca51244674f5b21ba150bd483b39f7c812','owner',?)").bind(now+86400000).run();await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('group','Private Group','alice',1)").run();for(const[id,role]of[['alice','member'],['bob','member']])await db.prepare("INSERT INTO group_members(group_id,user,role,joined) VALUES('group',?,?,1)").bind(id,role).run();
await seedStaffAcceptance(db,'owner',now);await db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES('owner',?)").bind('owner').run();
await db.prepare("INSERT OR IGNORE INTO rules_acceptances(user_id,rules_version,accepted_at) SELECT id,'2026-10-07.1',1 FROM members").run();
async function req(user,body,room='public',extra='',pin=true,origin){const r=await mf.dispatchFetch('https://test.invalid/api/chat?room='+encodeURIComponent(room)+extra,{method:body?'POST':'GET',headers:{...(user?{cookie:'hunt_login='+user+(user==='owner'&&pin?'; hunt_admin=pin':'')}:{ }),...(body?{'content-type':'application/json'}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()}}
const message=(body,room='public',id=crypto.randomUUID())=>({action:'send',room,body,id});assert.equal((await req(null)).status,401);for(const user of ['pending','blocked']){assert.equal((await req(user)).status,403);assert.equal((await req(user,message('no'))).status,403)}
let sent=message('Hei alle!');assert.equal((await req('alice',sent)).status,200);assert.equal((await req('alice',sent)).status,200,'lost-response retry returns same message');assert.equal((await db.prepare('SELECT COUNT(*) n FROM chat_messages').first()).n,1);assert.equal((await req('bob',{...sent,body:'stolen'})).status,409);assert.equal((await req('alice',message('too fast'))).status,429);assert.equal((await req('bob',message(' ', 'public'))).status,400);assert.equal((await req('bob',message('x'.repeat(1501)))).status,400);assert.equal((await req('bob',message('blocked origin'),'public','',true,'https://other.invalid')).status,403);
const publicView=await req('outsider');assert.equal(publicView.data.messages[0].body,'Hei alle!');assert.equal(publicView.data.groups.length,0);const groupView=await req('alice',undefined,'group');assert.equal(groupView.data.groups.length,1);assert.equal(groupView.data.canModerate,true);assert.equal((await req('owner',undefined,'group')).status,403,'site admin cannot snoop private group');assert.equal((await req('outsider',undefined,'group')).status,403);assert.equal((await req('outsider',message('private trespass','group'))).status,403);
await db.prepare("DELETE FROM settings WHERE key='chat-rate:bob'").run();const secret=message('Dette er bare til gruppen.', 'group');assert.equal((await req('bob',secret,'group')).status,200);assert(!(await req('outsider')).data.messages.some(m=>m.id===secret.id));assert.equal((await req('alice',undefined,'group')).data.messages[0].body,secret.body);assert.equal((await req('bob',{action:'delete',room:'public',id:sent.id})).status,403);// Reactions are per-user, replaceable, and bounded to the selected room.
for(const emoji of ['❤️','❤️','👍'])assert.equal((await req('bob',{action:'react',room:'public',id:sent.id,emoji})).status,200);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM chat_reactions WHERE message=?').bind(sent.id).first()).n,1);
assert.equal((await req('outsider')).data.messages.find(m=>m.id===sent.id).reactions[0].emoji,'👍');
assert.equal((await req('bob')).data.messages.find(m=>m.id===sent.id).reactions[0].mine,1);
assert.equal((await req('bob',{action:'react',room:'public',id:sent.id,emoji:'bad'})).status,400);
assert.equal((await req('outsider',{action:'react',room:'public',id:secret.id,emoji:'❤️'})).status,404);
assert.equal((await req('outsider',{action:'react',room:'group',id:secret.id,emoji:'❤️'})).status,403);
assert.equal((await req('outsider',{...message('Cross-room leak'),replyTo:secret.id})).status,404);
const reply={...message('Svar til deg'),replyTo:sent.id};assert.equal((await req('outsider',reply)).status,200);assert.equal((await req('outsider',reply)).status,200);
assert.equal((await req('outsider')).data.messages.find(m=>m.id===reply.id).reply.body,sent.body);
assert.equal((await req('bob',{action:'react',room:'public',id:sent.id,emoji:null})).status,200);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM chat_reactions').first()).n,0);
assert.equal((await req('outsider',{action:'delete',room:'public',id:reply.id})).status,200);
assert.equal((await req('bob',{action:'react',room:'public',id:sent.id,emoji:'❤️'})).status,200);
assert.equal((await req('owner',{action:'delete',room:'public',id:sent.id},'public','',false)).status,403,'moderation requires admin login');assert.equal((await req('owner',{action:'delete',room:'public',id:sent.id})).status,200);
assert.equal((await db.prepare('SELECT COUNT(*) n FROM chat_reactions').first()).n,0,'deleting message cleans reactions');
await db.prepare("DELETE FROM group_members WHERE user='bob'").run();assert.equal((await req('bob',undefined,'group')).status,403);assert.equal((await req('bob',secret,'group')).status,403,'idempotent retry does not bypass revoked group membership');assert.equal((await req('bob',{action:'delete',room:'group',id:secret.id})).status,403);assert.equal((await req('alice',{action:'delete',room:'group',id:secret.id})).status,200,'group owner moderates own room');
const own=message('<script>alert(1)</script>\nText stays plain.');await db.prepare("DELETE FROM settings WHERE key='chat-rate:bob'").run();assert.equal((await req('bob',own)).status,200);assert.equal((await req('bob')).data.messages[0].body,own.body);assert.equal((await req('bob',{action:'delete',room:'public',id:own.id})).status,200);
// Admin updates require a current admin session, cannot be forged, and survive retries.
const update={action:'update',room:'public',id:crypto.randomUUID(),updateTitle:'Nytt i Foto Jakt!',updateIcon:'⚡',body:'En tilfeldig Lynjakt hver uke.\n\n🎯 Bonusoppdrag!'};
assert.equal((await req('owner')).data.canUpdate,true);
assert.equal((await req('bob')).data.canUpdate,false);
assert.equal((await req('owner',undefined,'public','',false)).data.canUpdate,false);
for(const user of ['bob','alice'])assert.equal((await req(user,update)).status,403);
assert.equal((await req('owner',update,'public','',false)).status,403);
assert.equal((await req('owner',{...update,room:'group'},'group')).status,403);
assert.equal((await req('alice',{...message('Forged'),updateTitle:'Fake'})).status,403);
assert.equal((await req('bob',message('/update'))).status,403);
assert.equal((await req('owner',{...update,updateTitle:' '})).status,400);
assert.equal((await req('owner',{...update,updateIcon:'bad'})).status,400);
assert.equal((await req('owner',update)).status,200);
assert.equal((await req('owner',update)).status,200,'retry does not duplicate update');
assert.equal((await req('owner',{...update,updateTitle:'Changed'})).status,409);
const card=(await req('bob')).data.messages.find(m=>m.id===update.id);
assert.equal(card.updateTitle,update.updateTitle);assert.equal(card.updateIcon,'⚡');assert.equal(card.body,update.body);assert.equal(card.name,'owner');assert(card.created>0);
assert.equal((await req('bob',{action:'react',room:'public',id:update.id,emoji:'🎉'})).status,200);
assert.equal((await req('owner',{action:'delete',room:'public',id:update.id})).status,200);
assert(!(await req('bob')).data.messages.some(m=>m.id===update.id));
// Tie timestamps still page in deterministic order without gaps or duplicates.
for(let i=0;i<110;i++)await db.prepare("INSERT INTO chat_messages(id,room,user,body,created) VALUES(?,'public','alice',?,?)").bind(String(i).padStart(4,'0'),'History '+i,now-1000+Math.floor(i/3)).run();let page=await req('outsider'),ids=[];while(true){assert.equal(page.status,200);assert(page.data.messages.length<=50);ids.push(...page.data.messages.map(m=>m.id));if(!page.data.hasMore)break;page=await req('outsider',undefined,'public','&before='+encodeURIComponent(page.data.nextBefore))}assert.equal(ids.length,110);assert.equal(new Set(ids).size,110);assert.equal((await req('outsider',undefined,'public','&before=invalid')).status,400);
// Direct chats are visible only to accepted friends, even for site admins.
const common=(await req('bob')).data.publicRoom;assert(common.lastMessage.body.startsWith('History '));assert(common.unread>0);assert.equal((await req('bob',{action:'read',room:'public',id:common.lastMessage.id})).status,200);assert.equal((await req('bob')).data.publicRoom.unread,0);assert(!('readBy' in (await req('alice')).data.messages.at(-1)),'public receipts stay private for participants');assert((await req('owner',null,'public')).data.messages.at(-1).readBy.some(r=>r.id==='bob'),'authorized admin can see public receipt');
await db.prepare("INSERT INTO groups(id,name,owner,created) VALUES('new-group','ZZ Last active','owner',1)").run();await db.prepare("INSERT INTO group_members(group_id,user,joined) VALUES('new-group','bob',1)").run();await db.prepare("INSERT INTO chat_messages(id,room,user,body,created) VALUES('sort-own','new-group','bob','Newest own message',?)").bind(now+100000).run();assert.equal((await req('bob')).data.groups[0].id,'new-group','own messages count for last-active ordering');
await db.prepare("INSERT INTO friendships(a,b,requester,status,created) VALUES('alice','bob','alice','accepted',1)").run();
const dm='dm:alice:bob';await db.prepare("DELETE FROM settings WHERE key='chat-rate:alice'").run();
const direct=message('Only us',dm);assert.equal((await req('alice',direct,dm)).status,200);assert.equal((await req('alice',direct,dm)).status,200);
assert.equal((await req('bob',undefined,dm)).data.messages[0].body,'Only us');
for(const viewer of ['owner','outsider'])assert.equal((await req(viewer,undefined,dm)).status,403);
let overview=(await req('bob')).data;assert.equal(overview.friends[0].unread,1);assert.equal(overview.friends[0].lastActivity,(await req('bob',undefined,dm)).data.messages[0].created);
assert.equal(overview.friends[0].lastMessage.body,'Only us');assert.equal(overview.friends[0].lastMessage.name,'alice');
let dmView=(await req('bob',undefined,dm)).data;assert.equal(dmView.messages[0].unread,true);assert.deepEqual(dmView.messages[0].readBy,[]);
const dmNoticeResponse=await mf.dispatchFetch('https://test.invalid/api/notifications',{headers:{cookie:'hunt_login=bob'}}),dmNotice=(await dmNoticeResponse.json()).items.find(n=>n.kind==='chat'&&n.room===dm);assert.equal(dmNotice.title,'FJ har mottatt en melding fra alice');assert.equal(dmNotice.message,direct.id);assert(dmNotice.detail.includes('Only us'));
assert.equal((await req('bob',{action:'react',room:dm,id:direct.id,emoji:'❤️'},dm)).status,200);
assert.equal((await req('bob',{action:'read',room:dm,id:direct.id},dm)).status,200);assert.equal((await req('bob')).data.friends[0].unread,0);
for(const viewer of ['alice','bob']){const m=(await req(viewer,undefined,dm)).data.messages[0];assert.equal(m.unread,false);assert.deepEqual(m.readBy,[{id:'bob',name:'bob'}]);}
assert.deepEqual((await req('alice')).data.friends[0].lastMessage.readBy,[{id:'bob',name:'bob'}],'sender sees read status in conversation preview');
// A notice can open its exact message even after more than a page of newer messages.
for(let i=0;i<60;i++)await db.prepare('INSERT INTO chat_messages(id,room,user,body,created) VALUES(?,?,?,?,?)').bind('dm-later-'+i,dm,'bob','Later '+i,now+200000+i).run();
const targeted=(await req('bob',undefined,dm,'&message='+direct.id)).data;assert.equal(targeted.target,direct.id);assert.equal(targeted.messages.at(-1).id,direct.id);assert.equal((await req('bob',undefined,'public','&message='+direct.id)).status,404);
assert.equal((await req('bob',{action:'read',room:dm,id:'dm-later-59'},dm)).status,200);await req('bob',{action:'read',room:dm,id:direct.id},dm);assert.equal((await db.prepare('SELECT value FROM settings WHERE key=?').bind('dm-read:bob:'+dm).first()).value.includes('dm-later-59'),true,'old receipts cannot rewind read state');
assert.equal((await req('bob',{action:'delete',room:dm,id:direct.id},dm)).status,403);
assert.equal((await req('bob',{...message('cross-room'),replyTo:direct.id})).status,404);
await db.prepare("UPDATE friendships SET status='pending'").run();assert.equal((await req('alice',direct,dm)).status,403);assert.equal((await req('bob')).data.friends.length,0);
await db.prepare("UPDATE friendships SET status='accepted'").run();await db.prepare("UPDATE members SET status='blocked' WHERE id='alice'").run();assert.equal((await req('bob',undefined,dm)).status,403);assert.equal((await req('outsider')).data.messages.length,0,'blocked authors disappear');assert.equal((await req('alice',message('no'))).status,403);
await db.prepare("INSERT INTO chat_messages(id,room,user,body,created) VALUES('owned-group-message','group','bob','Group history',1),('unrelated','public','bob','Keep me',1)").run();const deleted=await mf.dispatchFetch('https://test.invalid/api/hunt',{method:'POST',headers:{cookie:'hunt_login=owner; hunt_admin=pin','content-type':'application/json'},body:JSON.stringify({action:'delete-member',id:'alice'})});assert.equal(deleted.status,200);assert.equal((await db.prepare("SELECT COUNT(*) n FROM chat_messages WHERE user='alice' OR room='group'").first()).n,0,'account and owned-group history removed');assert(await db.prepare("SELECT id FROM chat_messages WHERE id='unrelated'").first(),'unrelated messages remain');
console.log('PASS: approved public chat, private group isolation and revocation, admin/group moderation, own deletion, duplicate-safe send, rate/size/origin checks, deterministic pagination and blocked-account privacy.');
assert.equal((await db.prepare("SELECT COUNT(*) n FROM chat_messages WHERE room='dm:alice:bob'").first()).n,0,'deleted account removes both sides of direct chat');
}finally{await mf.dispose()}
