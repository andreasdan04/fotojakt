import {all,run,db} from './server';
import {chatWords,findChatWords} from './chat-word-filter';
export async function processChatReviews(now=Date.now()){
 // Drain legacy pending reviews locally. Never read images, files or external URLs.
 const rows=await all("SELECT r.message,x.room,x.body,x.update_title FROM chat_reviews r JOIN chat_messages x ON x.id=r.message WHERE r.status='pending' ORDER BY r.created LIMIT 50"),words=await chatWords();
 for(const row of rows){const hits=row.room==='public'?findChatWords(row.body+' '+(row.update_title||''),words):[];const status=row.room!=='public'?'manual':hits.length?'flagged':'clear';const reason=row.room!=='public'?'Rapportert privat innhold. Manuell vurdering nødvendig.':hits.length?'Treff i lokal ordliste: '+hits.join(', ')+'. Vurder sammenhengen manuelt.':'Ingen treff i ordlisten. Bilder og vedlegg er ikke kontrollert.';await run("UPDATE chat_reviews SET status=?,reason=?,categories=?,updated=?,lease=0 WHERE message=? AND status='pending'",status,reason,JSON.stringify(hits.length?['word_filter']:[]),now,row.message)}
 const cutoff=now-86400000,d=db();await d.batch([d.prepare("INSERT OR IGNORE INTO settings(key,value) SELECT 'deleted-photo:chat:'||id,key FROM chat_attachments WHERE message IS NULL AND created<?").bind(cutoff),d.prepare('DELETE FROM chat_attachments WHERE message IS NULL AND created<?').bind(cutoff)]);
 return {processed:rows.length};
}
