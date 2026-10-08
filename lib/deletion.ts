import {all,one,fail,db,bucket,str} from './server';
import {chatCleanupStatements} from './chat-media';
// Queue blob cleanup in the same transaction as removing its private metadata.
// The scheduler retries R2 failures; removed photos become inaccessible immediately.
export async function cleanDeletedPhotos(){const queued=await all("SELECT key,value FROM settings WHERE key GLOB 'deleted-photo:*' LIMIT 100");for(const row of queued){try{await bucket().delete(row.value);await db().prepare('DELETE FROM settings WHERE key=?').bind(row.key).run()}catch{await db().prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('privacy-file-cleanup-failed',String(Date.now())).run();console.error('Photo cleanup will retry')}}}
export function contentDeletionStatements(kind:'photo'|'own-photo'|'challenge'|'season'|'reset',value:any){
 const id=str(value,100),d=db(),statements:any[]=[];
 const challenges=kind==='season'?'SELECT id FROM challenges WHERE season=?':'SELECT id FROM challenges WHERE id=?';
 const photos=(kind==='photo'||kind==='own-photo')?'SELECT id FROM submissions WHERE id=?':`SELECT id FROM submissions WHERE challenge IN (${challenges})`;
 statements.push(d.prepare(`INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:'||id,key FROM submissions WHERE id IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM favorite_votes WHERE candidate IN (SELECT token FROM favorite_candidates WHERE submission IN (${photos}))`).bind(id));
 statements.push(d.prepare(`DELETE FROM favorite_candidates WHERE submission IN (${photos})`).bind(id));
 if(kind==='season')statements.push(d.prepare('DELETE FROM favorite_polls WHERE season=?').bind(id));
 for(const table of ['bonus_reviews','photo_votes','photo_voters','photo_reports','photo_admin_reports'])statements.push(d.prepare(`DELETE FROM ${table} WHERE submission IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM review_push WHERE submission IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM review_appeals WHERE decision IN(SELECT id FROM review_decisions WHERE submission IN (${photos}))`).bind(id));
 statements.push(d.prepare(`DELETE FROM review_decisions WHERE submission IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM social_push WHERE submission IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM comments WHERE submission IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM reactions WHERE submission IN (${photos})`).bind(id));
 if(kind==='photo'||kind==='own-photo'){
  if(kind==='photo')
  statements.push(d.prepare('DELETE FROM starts WHERE (user,challenge) IN (SELECT user,challenge FROM submissions WHERE id=?)').bind(id));
  statements.push(d.prepare('DELETE FROM captures WHERE (user,challenge) IN (SELECT user,challenge FROM submissions WHERE id=?)').bind(id));
 }
 else{
  if(kind!=='reset'){statements.push(d.prepare(`DELETE FROM difficulty_votes WHERE poll IN (SELECT id FROM difficulty_polls WHERE challenge IN (${challenges}))`).bind(id));statements.push(d.prepare(`DELETE FROM difficulty_polls WHERE challenge IN (${challenges})`).bind(id));statements.push(d.prepare(`DELETE FROM hunt_changes WHERE challenge IN (${challenges})`).bind(id));}
  statements.push(d.prepare(`DELETE FROM starts WHERE challenge IN (${challenges})`).bind(id));
  statements.push(d.prepare(`DELETE FROM captures WHERE challenge IN (${challenges})`).bind(id));
  statements.push(d.prepare(`DELETE FROM push_deliveries WHERE challenge IN (${challenges})`).bind(id));
 }
 statements.push(d.prepare(`DELETE FROM settings WHERE key IN(SELECT 'metadata-retry:'||key FROM submissions WHERE id IN (${photos}))`).bind(id));
 statements.push(d.prepare(`DELETE FROM settings WHERE key IN(SELECT 'metadata-cleaned:'||key FROM submissions WHERE id IN (${photos}))`).bind(id));
 statements.push(d.prepare(`DELETE FROM settings WHERE key IN(SELECT 'bonus-opt:'||id FROM submissions WHERE id IN (${photos}))`).bind(id));
 statements.push(d.prepare(`UPDATE chat_messages SET shared_photo=NULL WHERE shared_photo IN (${photos})`).bind(id));
 statements.push(d.prepare(`DELETE FROM submissions WHERE id IN (${photos})`).bind(id));
 if(kind!=='photo'&&kind!=='own-photo'&&kind!=='reset')statements.push(d.prepare(`DELETE FROM challenges WHERE id IN (${challenges})`).bind(id));
 if(kind==='season')statements.push(d.prepare('DELETE FROM seasons WHERE id=?').bind(id));
 return statements;
}
export async function deleteContent(kind:'photo'|'challenge'|'season',value:any){
 await db().batch(contentDeletionStatements(kind,value));await cleanDeletedPhotos();
}

export async function deleteMember(value:any,actor:string){
 const id=str(value,100),m=await one('SELECT admin FROM members WHERE id=?',id);
 if(!m)fail('Medlemmet er allerede slettet.',404);
 if(m.admin||id===actor)fail('Administratorkontoen kan ikke slettes.',403);
 const d=db(),q:any[]=[],photos='SELECT id FROM submissions WHERE user=?',anonymous='deleted:'+crypto.randomUUID();
 q.push(d.prepare('DELETE FROM review_push WHERE submission IN(SELECT id FROM submissions WHERE user=?) OR subscription IN(SELECT id FROM push_subscriptions WHERE user=?)').bind(id,id));
 q.push(d.prepare('DELETE FROM staff_roles WHERE user=?').bind(id));
 q.push(d.prepare('UPDATE staff_acceptances SET revoked=COALESCE(revoked,?) WHERE user=?').bind(Date.now(),id));
 q.push(d.prepare('DELETE FROM review_appeals WHERE user=? OR decision IN(SELECT id FROM review_decisions WHERE submission IN(SELECT id FROM submissions WHERE user=?))').bind(id,id));
 q.push(d.prepare('DELETE FROM review_decisions WHERE submission IN(SELECT id FROM submissions WHERE user=?)').bind(id));
 q.push(d.prepare("UPDATE review_decisions SET actor=NULL WHERE actor=?").bind(id));
 q.push(d.prepare("UPDATE review_appeals SET reviewer=NULL WHERE reviewer=?").bind(id));
 q.push(d.prepare('DELETE FROM rules_acceptances WHERE user_id=?').bind(id));
 q.push(d.prepare(`DELETE FROM photo_admin_reports WHERE reporter=? OR submission IN (${photos})`).bind(id,id));
 q.push(d.prepare("DELETE FROM settings WHERE key IN(SELECT 'metadata-retry:'||key FROM submissions WHERE user=? UNION SELECT 'metadata-retry:'||key FROM avatars WHERE user=? UNION SELECT 'metadata-retry:'||key FROM chat_attachments WHERE user=?)").bind(id,id,id));
 q.push(d.prepare("DELETE FROM settings WHERE key IN(SELECT 'metadata-cleaned:'||key FROM submissions WHERE user=? UNION SELECT 'metadata-cleaned:'||key FROM avatars WHERE user=? UNION SELECT 'metadata-cleaned:'||key FROM chat_attachments WHERE user=?)").bind(id,id,id));
 q.push(d.prepare("DELETE FROM settings WHERE key IN ('privacy:'||?,'push_disabled:'||?,'age:'||?,'admin-agreement:'||?,'admin-credential:'||?) OR key IN(SELECT 'push_test:'||id FROM push_subscriptions WHERE user=?) OR key IN(SELECT 'bonus-opt:'||id FROM submissions WHERE user=?)").bind(id,id,id,id,id,id,id));
 q.push(d.prepare("UPDATE difficulty_polls SET actor='deleted' WHERE actor=?").bind(id));q.push(d.prepare('UPDATE chat_reviews SET reviewer=NULL WHERE reviewer=?').bind(id));
 q.push(d.prepare("DELETE FROM settings WHERE key LIKE 'chat-report:%' AND (json_extract(value,'$.user')=? OR substr(key,13) IN(SELECT id FROM chat_messages WHERE user=?))").bind(id,id));
 q.push(d.prepare("DELETE FROM settings WHERE key LIKE 'privacy-audit:%' AND json_extract(value,'$.actor')=?").bind(id));
 const bugRows=await all("SELECT key,value FROM settings WHERE key LIKE 'bug-report:%' AND json_extract(value,'$.user')=?",id);
 for(const row of bugRows){const report=JSON.parse(row.value);if(report.imageKey)q.push(d.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').bind('deleted-photo:'+report.imageKey,report.imageKey));q.push(d.prepare('DELETE FROM settings WHERE key=?').bind(row.key));}
 q.push(d.prepare('DELETE FROM settings WHERE key IN (?,?,?,?)').bind('profile:'+id,'bug-last:'+id,'leaderboard_filter:'+id,'active_title:'+id));
 q.push(d.prepare('DELETE FROM game_awards WHERE user=?').bind(id));
 q.push(d.prepare('DELETE FROM settings WHERE key=?').bind('dm-read:'+id+':public'));
 q.push(d.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:'||id,key FROM submissions WHERE user=?").bind(id));
 q.push(d.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:avatar:'||user,key FROM avatars WHERE user=?").bind(id));
 q.push(d.prepare(`DELETE FROM favorite_votes WHERE user=? OR candidate IN (SELECT token FROM favorite_candidates WHERE submission IN (${photos})) OR poll IN (SELECT id FROM favorite_polls WHERE group_id IN (SELECT id FROM groups WHERE owner=?))`).bind(id,id,id));
 q.push(d.prepare(`DELETE FROM favorite_candidates WHERE submission IN (${photos}) OR poll IN (SELECT id FROM favorite_polls WHERE group_id IN (SELECT id FROM groups WHERE owner=?))`).bind(id,id));
 q.push(d.prepare('DELETE FROM favorite_polls WHERE group_id IN (SELECT id FROM groups WHERE owner=?)').bind(id));
 q.push(d.prepare('DELETE FROM hunt_changes WHERE user=?').bind(id));q.push(d.prepare('DELETE FROM difficulty_votes WHERE user=?').bind(id));
 q.push(d.prepare("DELETE FROM invitation_push WHERE recipient=? OR actor=? OR (kind='group' AND source IN (SELECT id FROM groups WHERE owner=?))").bind(id,id,id));
 const directRooms="SELECT 'dm:'||a||':'||b FROM friendships WHERE a=? OR b=?";
 q.push(...chatCleanupStatements(`user=? OR room IN (${directRooms}) OR room IN (SELECT id FROM groups WHERE owner=?)`,[id,id,id,id]));
 q.push(d.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:chat:'||id,key FROM chat_attachments WHERE user=? AND message IS NULL").bind(id));
 q.push(d.prepare('DELETE FROM chat_attachments WHERE user=? AND message IS NULL').bind(id));
 q.push(d.prepare(`DELETE FROM chat_reactions WHERE message IN (SELECT id FROM chat_messages WHERE room IN (${directRooms}))`).bind(id,id));
 q.push(d.prepare(`DELETE FROM chat_messages WHERE room IN (${directRooms})`).bind(id,id));
 q.push(d.prepare(`DELETE FROM settings WHERE key IN (SELECT 'dm-read:'||a||':dm:'||a||':'||b FROM friendships WHERE a=? OR b=? UNION SELECT 'dm-read:'||b||':dm:'||a||':'||b FROM friendships WHERE a=? OR b=?)`).bind(id,id,id,id));
 q.push(d.prepare('DELETE FROM chat_push WHERE subscription IN (SELECT id FROM push_subscriptions WHERE user=?) OR message IN (SELECT id FROM chat_messages WHERE user=? OR room IN (SELECT id FROM groups WHERE owner=?))').bind(id,id,id));
 q.push(d.prepare('DELETE FROM chat_reactions WHERE user=? OR message IN (SELECT id FROM chat_messages WHERE user=? OR room IN (SELECT id FROM groups WHERE owner=?))').bind(id,id,id));
 q.push(d.prepare('DELETE FROM chat_messages WHERE user=? OR room IN (SELECT id FROM groups WHERE owner=?)').bind(id,id));q.push(d.prepare('DELETE FROM settings WHERE key=?').bind('chat-rate:'+id));
 q.push(d.prepare('DELETE FROM word_suggestions WHERE user=?').bind(id));
 q.push(d.prepare('DELETE FROM feature_suggestions WHERE user=?').bind(id));
 for(const table of ['bonus_reviews','photo_votes','photo_voters','photo_reports'])q.push(d.prepare(`DELETE FROM ${table} WHERE submission IN (${photos})`).bind(id));
 // Replacement identifiers are pseudonyms, not proof of anonymity; decision totals remain.
 for(const table of ['photo_votes','photo_voters'])q.push(d.prepare(`UPDATE ${table} SET user=? WHERE user=?`).bind(anonymous,id));
 q.push(d.prepare("UPDATE photo_reports SET reporter=?,reason='' WHERE reporter=?").bind(anonymous,id));
 q.push(d.prepare(`DELETE FROM social_push WHERE actor=? OR submission IN (${photos}) OR subscription IN (SELECT id FROM push_subscriptions WHERE user=?)`).bind(id,id,id));
 q.push(d.prepare('DELETE FROM push_deliveries WHERE subscription IN (SELECT id FROM push_subscriptions WHERE user=?)').bind(id));
 for(const table of ['comments','reactions'])q.push(d.prepare(`DELETE FROM ${table} WHERE user=? OR submission IN (${photos})`).bind(id,id));
 for(const table of ['usage_daily','usage_activity','submissions','avatars','captures','starts','sessions','login_sessions','local_accounts','push_subscriptions','notification_preferences'])q.push(d.prepare(`DELETE FROM ${table} WHERE user=?`).bind(id));
 for(const table of ['group_members','group_invites'])q.push(d.prepare(`DELETE FROM ${table} WHERE user=? OR group_id IN (SELECT id FROM groups WHERE owner=?)`).bind(id,id));
 q.push(d.prepare('DELETE FROM group_invites WHERE inviter=?').bind(id));
 q.push(d.prepare('DELETE FROM group_links WHERE creator=? OR group_id IN (SELECT id FROM groups WHERE owner=?)').bind(id,id));
 q.push(d.prepare('DELETE FROM groups WHERE owner=?').bind(id));
 q.push(d.prepare('DELETE FROM friendships WHERE a=? OR b=?').bind(id,id));
 q.push(d.prepare('DELETE FROM user_reports WHERE target=?').bind(id));
 q.push(d.prepare("UPDATE user_reports SET reporter=?,reason='' WHERE reporter=?").bind(anonymous,id));
 q.push(d.prepare('DELETE FROM members WHERE id=? AND admin=0').bind(id));
 await d.batch(q);await cleanDeletedPhotos();
}

export async function deleteOwnPhoto(value:any,user:string){
 const id=str(value,100),photo=await one('SELECT challenge FROM submissions WHERE id=? AND user=?',id,user);
 if(!photo)fail('Bildet finnes ikke eller tilhører en annen deltaker.',404);
 await db().batch(contentDeletionStatements('own-photo',id));await cleanDeletedPhotos();
 return {ok:true,resetUser:user,resetChallenge:photo.challenge};
}
