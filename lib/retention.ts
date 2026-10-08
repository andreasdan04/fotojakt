import {stripImageMetadata} from './image-privacy';
import {bucket} from './server';
import {all,one,run,db} from './server';
import {cleanDeletedPhotos,contentDeletionStatements} from './deletion';
import {chatCleanupStatements} from './chat-media';
export async function runRetention(now=Date.now()){
 const d=db(),day=86400000,last=await one("SELECT value FROM settings WHERE key='privacy-cleanup'");if(Number(last?.value)>now-3600000)return {ok:true,skipped:true};
 const legacy=await all("SELECT key,mime FROM (SELECT key,'image/jpeg' mime FROM submissions UNION SELECT key,'image/jpeg' mime FROM avatars UNION SELECT key,mime FROM chat_attachments WHERE mime IN ('image/jpeg','image/png','image/webp') UNION SELECT json_extract(value,'$.imageKey') key,'' mime FROM settings WHERE key LIKE 'bug-report:%' AND json_extract(value,'$.imageKey')!='') objects WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key='metadata-cleaned:'||objects.key) AND NOT EXISTS(SELECT 1 FROM settings WHERE key='metadata-retry:'||objects.key AND CAST(value AS INTEGER)>?) LIMIT 20",now);let metadataFailures=0;
 for(const object of legacy){try{const file=await bucket().get(object.key);if(file){const mime=object.mime||file.httpMetadata?.contentType;if(!mime)throw Error('missing-type');const bytes=stripImageMetadata(await file.arrayBuffer(),mime);await bucket().put(object.key,bytes,{httpMetadata:{contentType:mime}})}await run('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)','metadata-cleaned:'+object.key,String(now));await run('DELETE FROM settings WHERE key=?','metadata-retry:'+object.key);}catch{metadataFailures++;await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','metadata-retry:'+object.key,String(now+86400000));}}
 // Bounded batches retry on the next tick. Durable file cleanup is queued before metadata deletion.
 const oldPhotos=await all('SELECT id FROM submissions WHERE submitted<? ORDER BY submitted LIMIT 50',now-730*day);
 for(const p of oldPhotos)await d.batch(contentDeletionStatements('own-photo',p.id));
 const oldMessages=await all('SELECT id FROM chat_messages WHERE created<? ORDER BY created LIMIT 100',now-365*day);
 for(const x of oldMessages)await d.batch([...chatCleanupStatements('id=?',[x.id]),d.prepare('DELETE FROM chat_push WHERE message=?').bind(x.id),d.prepare('DELETE FROM chat_reactions WHERE message=?').bind(x.id),d.prepare('DELETE FROM chat_messages WHERE id=?').bind(x.id),d.prepare('DELETE FROM settings WHERE key=?').bind('chat-report:'+x.id)]);
 await d.batch([
 d.prepare('DELETE FROM login_sessions WHERE expires<=?').bind(now),d.prepare('DELETE FROM sessions WHERE expires<=?').bind(now),d.prepare('DELETE FROM attempts WHERE until<=?').bind(now),d.prepare('DELETE FROM captures WHERE expires<=?').bind(now),
 d.prepare("DELETE FROM usage_daily WHERE day<? OR NOT EXISTS(SELECT 1 FROM settings WHERE key='privacy:'||usage_daily.user AND json_extract(value,'$.analytics')=1)").bind(new Date(now-90*day).toISOString().slice(0,10)),d.prepare('DELETE FROM usage_activity WHERE last_seen<=?').bind(now-1800000),
 d.prepare("DELETE FROM settings WHERE key LIKE 'admin-agreement:%' AND CAST(json_extract(value,'$.revoked') AS INTEGER)<?").bind(now-90*day),
 d.prepare("DELETE FROM chat_reviews WHERE message IN(SELECT id FROM chat_messages WHERE room!='public') AND NOT EXISTS(SELECT 1 FROM settings WHERE key='chat-report:'||chat_reviews.message)"),
 d.prepare("DELETE FROM chat_reviews WHERE (status='clear' AND updated<?) OR (status IN ('confirmed','dismissed') AND updated<?)").bind(now-7*day,now-90*day),
 d.prepare("UPDATE bonus_reviews SET reason='' WHERE status IN ('approved','rejected') AND updated<?").bind(now-90*day),
 ...['push_deliveries','social_push','chat_push','invitation_push'].map(t=>d.prepare(`DELETE FROM ${t} WHERE created<? OR subscription NOT IN(SELECT id FROM push_subscriptions)`).bind(now-30*day)),
 d.prepare("DELETE FROM settings WHERE key LIKE 'metadata-cleaned:%' AND substr(key,18) NOT IN(SELECT key FROM submissions UNION SELECT key FROM avatars UNION SELECT key FROM chat_attachments UNION SELECT json_extract(value,'$.imageKey') FROM settings WHERE key LIKE 'bug-report:%' AND json_extract(value,'$.imageKey') IS NOT NULL)"),
 d.prepare("DELETE FROM settings WHERE key LIKE 'metadata-retry:%' AND substr(key,16) NOT IN(SELECT key FROM submissions UNION SELECT key FROM avatars UNION SELECT key FROM chat_attachments UNION SELECT json_extract(value,'$.imageKey') FROM settings WHERE key LIKE 'bug-report:%' AND json_extract(value,'$.imageKey') IS NOT NULL)"),
 d.prepare("DELETE FROM settings WHERE key IN(SELECT 'push_test:'||id FROM push_subscriptions WHERE updated<?)").bind(now-90*day),d.prepare('DELETE FROM push_subscriptions WHERE updated<?').bind(now-90*day),
 d.prepare("DELETE FROM settings WHERE key LIKE 'privacy-audit:%' AND CAST(json_extract(value,'$.created') AS INTEGER)<?").bind(now-30*day),
 d.prepare("DELETE FROM settings WHERE key LIKE 'bonus-opt:%' AND substr(key,11) NOT IN(SELECT id FROM submissions)"),
 d.prepare("DELETE FROM photo_admin_reports WHERE (status='resolved' AND resolved_at<?) OR submission NOT IN(SELECT id FROM submissions)").bind(now-90*day),
 d.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:chat:'||id,key FROM chat_attachments WHERE message IS NULL AND created<?").bind(now-day),d.prepare('DELETE FROM chat_attachments WHERE message IS NULL AND created<?').bind(now-day)
 ]);
 const bugs=await all("SELECT key,value FROM settings WHERE key LIKE 'bug-report:%' AND json_extract(value,'$.resolved')=1 AND COALESCE(json_extract(value,'$.resolvedAt'),json_extract(value,'$.created'))<? LIMIT 50",now-90*day);
 for(const row of bugs){const b=JSON.parse(row.value);if(b.imageKey)await run('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)','deleted-photo:'+b.imageKey,b.imageKey);await run('DELETE FROM settings WHERE key=?',row.key);}
 await cleanDeletedPhotos();const queued=await one("SELECT COUNT(*) n FROM settings WHERE key LIKE 'deleted-photo:%'");await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','privacy-cleanup-status',JSON.stringify({created:now,queuedFiles:queued.n,metadataFailures,photos:oldPhotos.length,messages:oldMessages.length}));await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','privacy-cleanup',String(now));return {ok:true,queuedFiles:queued.n,metadataFailures,photos:oldPhotos.length,messages:oldMessages.length};
}
