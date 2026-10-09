import {all,one,run,db,fail,str} from './server';
import {requirePhotoAudience,audienceSql} from './groups';
import {queueChat} from './chat-notifications';
import {recordUsage} from './usage';
import {chatWords,findChatWords} from './chat-word-filter';
import {STAFF_CHAT_ROOM,staffChatGuard} from './staff-chat';
export async function sendChat(b:any,m:any,room:string){
 const id=typeof b.id==='string'?b.id:'';if(!/^[a-f0-9-]{36}$/i.test(id))fail('Ugyldig melding.');
 const photo=b.photo==null?null:str(b.photo,100),ids=b.attachments==null?[]:b.attachments;
 if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some((x:any)=>typeof x!=='string'||!/^[a-f0-9-]{36}$/i.test(x)))fail('Velg opptil tre vedlegg.');
 const updateTitle=b.action==='update'?str(b.updateTitle,100):null,updateIcon=updateTitle?(b.updateIcon||null):null;
 if(updateIcon!==null&&!['⚡','🎯','📢','✨','🎉','📸','ℹ️'].includes(updateIcon))fail('Velg et gyldig ikon.');
 if(b.action==='send'&&typeof b.body==='string'&&/^\/update(?:\s|$)/i.test(b.body.trim()))fail('Kun admin kan bruke /update. Åpne oppdateringsskjemaet.',403);
 const body=str(typeof b.body==='string'&&b.body.trim()?b.body:photo?'📸 Delt jaktbilde':ids.length?'📎 Vedlegg':b.body,1500),replyTo=b.replyTo==null?null:str(b.replyTo,100);
 async function matches(){const x=await one('SELECT * FROM chat_messages WHERE id=?',id);if(!x)return false;const saved=await all('SELECT id FROM chat_attachments WHERE message=? ORDER BY id',id);return x.user===m.id&&x.room===room&&x.body===body&&(x.update_title||null)===updateTitle&&(x.update_icon||null)===updateIcon&&(x.reply_to||null)===replyTo&&(x.shared_photo||null)===photo&&JSON.stringify(saved.map((a:any)=>a.id))===JSON.stringify([...ids].sort());}
 if(await one('SELECT id FROM chat_messages WHERE id=?',id)){if(!await matches())fail('Meldingen er allerede brukt.',409);await queueChat(id);return {ok:true,id};}
 if(replyTo&&!await one("SELECT x.id FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.id=? AND x.room=? AND m.status='approved'",replyTo,room))fail('Meldingen du svarer på er ikke tilgjengelig.',404);
 if(photo){if(!await one('SELECT id FROM submissions WHERE id=? AND user=?',photo,m.id))fail('Du kan bare dele dine egne jaktbilder.',403);await requirePhotoAudience(photo,m.id);const s=await one("SELECT s.id FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE s.id=? AND c.end<=?",photo,Date.now());if(!s)fail('Jaktbilder kan deles i chat når jakten er ferdig.',403);}
 if(ids.length){const rows=await all(`SELECT id FROM chat_attachments WHERE id IN (${ids.map(()=>'?').join(',')}) AND user=? AND room=? AND message IS NULL`,...ids,m.id,room);if(rows.length!==ids.length)fail('Et vedlegg er ikke tilgjengelig i denne chatten.',403);}
 const now=Date.now(),claimed=await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<=?','chat-rate:'+m.id,String(now+1000),now);if(!claimed.meta.changes)fail('Vent et øyeblikk før du sender neste melding.',429);
 let extra=updateTitle?' AND EXISTS(SELECT 1 FROM members WHERE id=? AND admin=1)':'',args:any[]=updateTitle?[m.id]:[];
 if(ids.length){extra+=` AND (SELECT COUNT(*) FROM chat_attachments WHERE id IN (${ids.map(()=>'?').join(',')}) AND user=? AND room=? AND message IS NULL)=?`;args.push(...ids,m.id,room,ids.length);}
 if(photo){extra+=` AND EXISTS(SELECT 1 FROM submissions s JOIN challenges c ON c.id=s.challenge JOIN members a ON a.id=s.user WHERE s.id=? AND c.end<=? AND a.status='approved' AND ${audienceSql(m.id)})`;extra+=' AND EXISTS(SELECT 1 FROM submissions WHERE id=? AND user=?)';args.push(photo,now,photo,m.id);}
 const teamGuard=staffChatGuard(m.id);
 const teamAccess=room===STAFF_CHAT_ROOM?teamGuard.sql:`(?='public' OR EXISTS(SELECT 1 FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=? AND gm.user=?) OR EXISTS(SELECT 1 FROM friendships f JOIN members a ON a.id=f.a JOIN members z ON z.id=f.b WHERE 'dm:'||f.a||':'||f.b=? AND (f.a=? OR f.b=?) AND f.status='accepted' AND a.status='approved' AND z.status='approved'))`;
 const teamArgs=room===STAFF_CHAT_ROOM?teamGuard.args:[room,room,m.id,room,m.id,m.id];
 const d=db(),statements=[d.prepare(`INSERT OR IGNORE INTO chat_messages(id,room,user,body,created,reply_to,shared_photo,update_title,update_icon) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM members WHERE id=? AND status='approved') AND ${teamAccess}${extra}`).bind(id,room,m.id,body,now,replyTo,photo,updateTitle,updateIcon,m.id,...teamArgs,...args)];
 if(ids.length)statements.push(d.prepare(`UPDATE chat_attachments SET message=? WHERE id IN (${ids.map(()=>'?').join(',')}) AND user=? AND room=? AND message IS NULL AND EXISTS(SELECT 1 FROM chat_messages WHERE id=? AND user=? AND room=?)`).bind(id,...ids,m.id,room,id,m.id,room));
 const hits=room==='public'?findChatWords(body+' '+(updateTitle||''),await chatWords()):[];
 if(hits.length)statements.push(d.prepare("INSERT OR IGNORE INTO chat_reviews(message,status,reason,categories,created,updated) SELECT id,'flagged',?,?,created,? FROM chat_messages WHERE id=? AND user=? AND room=? AND room='public'").bind('Treff i lokal ordliste: '+hits.join(', ')+'. Vurder sammenhengen manuelt.',JSON.stringify(['word_filter']),now,id,m.id,room));
 const result=await d.batch(statements);if(!result[0].meta.changes&&!await matches())fail('Tilgangen til chatten eller vedleggene er endret. Last siden på nytt.',403);
 await queueChat(id);try{await recordUsage(m.id,'chat_send')}catch{console.error('Usage recording unavailable')}return {ok:true,id};
}
