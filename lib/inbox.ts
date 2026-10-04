import {WORD_CHANGED_MESSAGE,POLL_OPEN_MESSAGE} from './replace-word';
import {audienceSql} from './groups';
import {all,one} from './server';

export async function inboxItems(user:string){
 const requests=await all("SELECT f.requester id,f.created,m.name FROM friendships f JOIN members m ON m.id=f.requester WHERE (f.a=? OR f.b=?) AND f.requester!=? AND f.status='pending' AND m.status='approved'",user,user,user);
 const invitations=await all("SELECT i.group_id id,i.created,g.name,m.name inviter FROM group_invites i JOIN groups g ON g.id=i.group_id JOIN group_members issuer ON issuer.group_id=g.id AND issuer.user=i.inviter JOIN members m ON m.id=i.inviter WHERE i.user=? AND (g.owner=i.inviter OR issuer.role='admin') AND m.status='approved'",user);
 const comments=await all(`SELECT x.id,x.created,x.body,m.name,s.challenge,c.season,CASE WHEN target.user=? THEN 1 ELSE 0 END reply FROM comments x JOIN submissions s ON s.id=x.submission JOIN challenges c ON c.id=s.challenge JOIN members m ON m.id=x.user LEFT JOIN comments target ON target.id=COALESCE(x.reply_to,x.parent_id) AND target.submission=x.submission AND target.deleted=0 WHERE (s.user=? OR target.user=?) AND x.user!=? AND x.deleted=0 AND m.status='approved' AND ${audienceSql(user)} AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?)) ORDER BY x.created DESC LIMIT 50`,user,user,user,user,Date.now(),user);
 const reactions=await all("SELECT r.id,r.emoji,m.name,s.challenge,c.season FROM reactions r JOIN submissions s ON s.id=r.submission JOIN challenges c ON c.id=s.challenge JOIN members m ON m.id=r.user WHERE s.user=? AND r.user!=? AND m.status='approved' ORDER BY s.submitted DESC,r.id LIMIT 50",user,user);
 const changes=await all("SELECT n.*,c.season,p.status pollStatus FROM hunt_changes n JOIN challenges c ON c.id=n.challenge LEFT JOIN difficulty_polls p ON p.id=n.poll WHERE n.user=? AND (n.kind!='difficulty-poll' OR p.status!='open' OR EXISTS(SELECT 1 FROM starts a WHERE a.challenge=n.challenge AND a.user=n.user)) ORDER BY n.created DESC LIMIT 50",user);
 return [
 ...changes.map((n:any)=>({id:'word-change:'+n.id,kind:n.kind,title:n.kind==='difficulty-poll'?'Avstemning om jaktord':'Jaktordet er byttet',detail:n.kind==='difficulty-poll'?(n.pollStatus==='open'?POLL_OPEN_MESSAGE:'Avstemningen er avsluttet. Se resultatet på forsiden.'):WORD_CHANGED_MESSAGE,created:n.created,hunt:n.challenge,season:n.season})),
  ...requests.map((r:any)=>({id:'friend:'+r.id+':'+r.created,kind:'friend',title:r.name+' vil bli venn med deg',detail:'Se venneforespørselen',created:r.created})),
  ...invitations.map((r:any)=>({id:'group:'+r.id+':'+r.created,kind:'group',title:'Invitasjon til '+r.name,detail:'Fra '+r.inviter,created:r.created})),
  ...comments.map((r:any)=>({id:'comment:'+r.id,kind:r.reply?'reply':'comment',title:r.name+(r.reply?' svarte på kommentaren din':' kommenterte bildet ditt'),detail:r.body.slice(0,140),created:r.created,hunt:r.challenge,season:r.season})),
  ...reactions.map((r:any)=>({id:'reaction:'+r.id+':'+r.emoji,kind:'reaction',title:r.name+' reagerte '+r.emoji+' på bildet ditt',detail:'Se bildet',created:0,hunt:r.challenge,season:r.season})),
 ].sort((a,b)=>b.created-a.created).slice(0,150);
}
export async function inboxSeen(user:string):Promise<string[]>{
 const row=await one('SELECT value FROM settings WHERE key=?','inbox_seen:'+user);
 try{const ids=JSON.parse(row?.value||'[]');return Array.isArray(ids)?ids.filter((id:any)=>typeof id==='string'):[]}catch{return []}
}
