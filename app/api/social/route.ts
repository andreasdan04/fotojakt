import {queueInvitation} from '@/lib/invitation-push';
import {all,one,run,db,member,admin,origin,wrap,json,fail,str} from '@/lib/server';
import {limit} from '@/lib/auth';
import {username} from '@/lib/groups';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{
 const m=await member(),q=new URL(req.url).searchParams.get('q')?.trim()||'';
 if(q){await limit(req,'search:'+m.id,120);if(q.length<2)return json({users:[]});return json({users:await all("SELECT id,name,username,(SELECT updated FROM avatars WHERE user=members.id) avatarVersion FROM members WHERE status='approved' AND id!=? AND (instr(lower(COALESCE(username,'')),lower(?))>0 OR instr(lower(name),lower(?))>0) ORDER BY username LIMIT 30",m.id,q.slice(0,40),q.slice(0,40))});}
 const friends=await all("SELECT f.*,m.id,m.name,m.username,(SELECT updated FROM avatars WHERE user=m.id) avatarVersion FROM friendships f JOIN members m ON m.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND m.status='approved'",m.id,m.id,m.id);
 const groups=await all('SELECT g.*,gm.role,gm.chat_notifications chatNotifications FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user=? ORDER BY g.created',m.id);
 for(const g of groups){g.members=await all("SELECT m.id,m.name,m.username,gm.role,(SELECT updated FROM avatars WHERE user=m.id) avatarVersion FROM group_members gm JOIN members m ON m.id=gm.user WHERE gm.group_id=? AND m.status='approved' ORDER BY m.name",g.id);g.canManage=g.owner===m.id||g.role==='admin';g.linkToken=g.canManage?(await one("SELECT l.token FROM group_links l JOIN groups g ON g.id=l.group_id JOIN group_members issuer ON issuer.group_id=g.id AND issuer.user=l.creator JOIN members author ON author.id=l.creator WHERE l.group_id=? AND author.status='approved' AND (g.owner=l.creator OR issuer.role='admin')",g.id))?.token||null:null;g.invites=g.canManage?await all('SELECT i.user,m.name,m.username FROM group_invites i JOIN members m ON m.id=i.user WHERE i.group_id=?',g.id):[];}
 const invitations=await all("SELECT g.id,g.name,m.name inviter FROM group_invites i JOIN groups g ON g.id=i.group_id JOIN group_members issuer ON issuer.group_id=g.id AND issuer.user=i.inviter AND (g.owner=i.inviter OR issuer.role='admin') JOIN members m ON m.id=i.inviter WHERE i.user=? AND m.status='approved'",m.id);
 let reports:any[]=[];try{await admin(req);reports=await all('SELECT r.*,m.name,m.username,m.status,u.name reporterName FROM user_reports r JOIN members m ON m.id=r.target LEFT JOIN members u ON u.id=r.reporter WHERE r.resolved=0 ORDER BY r.created DESC LIMIT 100')}catch{}
 return json({friends,groups,invitations,reports});
});
export const POST=wrap(async(req:Request)=>{
 origin(req);const m=await member(),b:any=await req.json(),now=Date.now();await limit(req,'social:'+m.id,80);
 if(b.action==='join-group-link'){
  const token=str(b.token,64);if(!/^[a-f0-9]{64}$/.test(token))fail('Gruppelenken er ugyldig.',404);
  const link=await one("SELECT g.id,g.name FROM group_links l JOIN groups g ON g.id=l.group_id JOIN group_members issuer ON issuer.group_id=g.id AND issuer.user=l.creator JOIN members author ON author.id=l.creator WHERE l.token=? AND author.status='approved' AND (g.owner=l.creator OR issuer.role='admin')",token);
  if(!link)fail('Denne gruppelenken er ikke aktiv lenger.',404);
  const joined=await run("INSERT OR IGNORE INTO group_members(group_id,user,joined) SELECT g.id,?,? FROM group_links l JOIN groups g ON g.id=l.group_id JOIN group_members issuer ON issuer.group_id=g.id AND issuer.user=l.creator JOIN members author ON author.id=l.creator WHERE l.token=? AND author.status='approved' AND (g.owner=l.creator OR issuer.role='admin') AND EXISTS(SELECT 1 FROM members WHERE id=? AND status='approved')",m.id,now,token,m.id);
  if(!joined.meta.changes&&!await one('SELECT user FROM group_members WHERE group_id=? AND user=?',link.id,m.id))fail('Denne gruppelenken er ikke aktiv lenger.',404);
  await run('DELETE FROM group_invites WHERE group_id=? AND user=?',link.id,m.id);
  return json({ok:true,group:link.id,name:link.name});
 }
 if(['create-group-link','revoke-group-link'].includes(b.action)){
  const group=str(b.group,100),g=await one('SELECT g.id,g.owner,gm.role FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=? AND gm.user=?',group,m.id);
  if(!g||(g.owner!==m.id&&g.role!=='admin'))fail('Bare gruppeeieren og gruppeadministratorer kan dele gruppen.',403);
  if(b.action==='revoke-group-link'){await run('DELETE FROM group_links WHERE group_id=?',group);return json({ok:true})}
  const existing=await one("SELECT l.token FROM group_links l JOIN group_members issuer ON issuer.group_id=l.group_id AND issuer.user=l.creator JOIN members author ON author.id=l.creator WHERE l.group_id=? AND author.status='approved' AND (l.creator=? OR issuer.role='admin')",group,g.owner);
  if(existing)return json({ok:true,token:existing.token});
  const token=(crypto.randomUUID()+crypto.randomUUID()).replaceAll('-','');
  await run('INSERT INTO group_links(token,group_id,creator,created) VALUES(?,?,?,?) ON CONFLICT(group_id) DO UPDATE SET token=excluded.token,creator=excluded.creator,created=excluded.created',token,group,m.id,now);
  return json({ok:true,token});
 }
 if(b.action==='username'){const name=username(b.username);if(await one('SELECT user FROM local_accounts WHERE login=? AND user!=?',name,m.id))fail('Brukernavnet er opptatt.');try{await run('UPDATE members SET username=? WHERE id=?',name,m.id)}catch{fail('Brukernavnet er opptatt.')}return json({ok:true});}
 if(b.action==='create-group'){const name=str(b.name,60);if((await one('SELECT COUNT(*) n FROM groups WHERE owner=?',m.id)).n>=20)fail('Du kan eie opptil 20 grupper.');const id=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO groups(id,name,owner,created) VALUES(?,?,?,?)').bind(id,name,m.id,now),db().prepare('INSERT INTO group_members(group_id,user,joined) VALUES(?,?,?)').bind(id,m.id,now)]);return json({ok:true,id});}
 if(['invite-group','remove-group-member','leave-group','answer-group','cancel-invite','group-role'].includes(b.action)){
  const id=str(b.group,100),g=await one('SELECT * FROM groups WHERE id=?',id);if(!g)fail('Gruppen finnes ikke.');
  if(b.action==='answer-group'){
   const invitation=await one("SELECT i.user FROM group_invites i JOIN members m ON m.id=i.inviter JOIN group_members issuer ON issuer.group_id=i.group_id AND issuer.user=i.inviter WHERE i.group_id=? AND i.user=? AND (i.inviter=? OR issuer.role='admin') AND m.status='approved'",id,m.id,g.owner);if(!invitation)fail('Invitasjonen er ikke tilgjengelig.',403);
   const q=[];if(b.accept===true)q.push(db().prepare('INSERT OR IGNORE INTO group_members(group_id,user,joined) VALUES(?,?,?)').bind(id,m.id,now));q.push(db().prepare('DELETE FROM group_invites WHERE group_id=? AND user=?').bind(id,m.id));await db().batch(q);
  }else if(b.action==='leave-group'){if(g.owner===m.id)fail('Gruppeeieren kan ikke forlate sin egen gruppe.');await db().batch([db().prepare('DELETE FROM group_members WHERE group_id=? AND user=?').bind(id,m.id),db().prepare('DELETE FROM group_invites WHERE group_id=? AND inviter=?').bind(id,m.id)]);}
  else{
   const manager=await one('SELECT role FROM group_members WHERE group_id=? AND user=?',id,m.id);
   if(g.owner!==m.id&&manager?.role!=='admin')fail('Bare gruppeeieren og gruppeadministratorer kan administrere medlemmer.',403);
   const target=str(b.user,100);if(target===g.owner)fail('Gruppeeieren kan ikke fjernes eller få endret rolle.',403);if(target===m.id)fail('Bruk «Forlat gruppen» for å gå ut.');
   const targetMember=await one('SELECT role FROM group_members WHERE group_id=? AND user=?',id,target);
   if(b.action==='group-role'){
    if(g.owner!==m.id)fail('Bare gruppeeieren kan endre roller.',403);
    if(!targetMember||!['admin','member'].includes(b.role))fail('Ugyldig medlem eller rolle.');
    const changes=[db().prepare('UPDATE group_members SET role=? WHERE group_id=? AND user=?').bind(b.role,id,target)];
    if(b.role==='member')changes.push(db().prepare('DELETE FROM group_invites WHERE group_id=? AND inviter=?').bind(id,target));
    await db().batch(changes);return json({ok:true});
   }
   if(b.action==='remove-group-member'&&targetMember?.role==='admin'&&g.owner!==m.id)fail('Bare gruppeeieren kan fjerne en administrator.',403);

   if(b.action==='invite-group'){
    if(!await one("SELECT id FROM members WHERE id=? AND status='approved'",target))fail('Brukeren er ikke tilgjengelig.');
    if(!await one("SELECT a FROM friendships WHERE status='accepted' AND ((a=? AND b=?) OR (a=? AND b=?))",m.id,target,target,m.id))fail('Dere må være venner før du kan invitere.');
    if(await one('SELECT user FROM group_members WHERE group_id=? AND user=?',id,target))fail('Brukeren er allerede med.');
    const inserted=await run('INSERT OR IGNORE INTO group_invites(group_id,user,inviter,created) VALUES(?,?,?,?)',id,target,m.id,now);if(inserted.meta.changes)await queueInvitation('group',id,target,m.id,now);
   }else if(b.action==='cancel-invite')await run('DELETE FROM group_invites WHERE group_id=? AND user=?',id,target);
   else await db().batch([db().prepare('DELETE FROM group_members WHERE group_id=? AND user=?').bind(id,target),db().prepare('DELETE FROM group_invites WHERE group_id=? AND inviter=?').bind(id,target)]);
  }return json({ok:true});
 }
 if(b.action==='resolve-report'){await admin(req);await run('UPDATE user_reports SET resolved=1 WHERE id=?',str(b.id,100));return json({ok:true});}
 const target=str(b.user,100);if(target===m.id)fail('Velg en annen bruker.');if(!await one("SELECT id FROM members WHERE id=? AND status='approved'",target))fail('Brukeren er ikke tilgjengelig.');
 if(b.action==='report-user'){const reason=str(b.reason,500);if(await one('SELECT id FROM user_reports WHERE reporter=? AND target=? AND resolved=0',m.id,target))fail('Du har allerede en åpen rapport på denne brukeren.');await run('INSERT INTO user_reports(id,reporter,target,reason,created) VALUES(?,?,?,?,?)',crypto.randomUUID(),m.id,target,reason,now);return json({ok:true});}
 const [a,c]=[m.id,target].sort();
 if(b.action==='friend-request'){const inserted=await run("INSERT OR IGNORE INTO friendships(a,b,requester,status,created) VALUES(?,?,?,'pending',?)",a,c,m.id,now);if(inserted.meta.changes)await queueInvitation('friend',m.id,target,m.id,now);}
 else if(b.action==='answer-friend'){
  const f=await one("SELECT requester FROM friendships WHERE a=? AND b=? AND status='pending'",a,c);if(!f||f.requester===m.id)fail('Ingen forespørsel å besvare.',403);
  if(b.accept===true)await run("UPDATE friendships SET status='accepted' WHERE a=? AND b=?",a,c);else await run('DELETE FROM friendships WHERE a=? AND b=?',a,c);
 }else if(b.action==='remove-friend')await run('DELETE FROM friendships WHERE a=? AND b=?',a,c);else fail('Ukjent handling.');
 return json({ok:true});
});
