import {db,one} from './server';
// Bounded owner-requested correction after the 4 October upload failure.
// A durable marker preserves any later manual result edits.
export async function repairUploadResult(){
 const marker='repair:upload:0f62bc74-1ad2-4ff7-b432-d63e3584beb9';
 if(await one('SELECT value FROM settings WHERE key=?',marker))return;
 const id='0f62bc74-1ad2-4ff7-b432-d63e3584beb9';
 const user='nFFZFJUgMaTF8grC0aiPtrhtQzxyKhx0MvNAmynPttrhtJJgUD8Vxb';
 const challenge='1375c662-5683-47bf-98f0-cf73c453ce7b';
 await db().batch([
  db().prepare('UPDATE submissions SET elapsed=23583 WHERE id=? AND user=? AND challenge=? AND submitted=1791090910483 AND elapsed=57243 AND NOT EXISTS (SELECT 1 FROM settings WHERE key=?)').bind(id,user,challenge,marker),
  db().prepare("INSERT OR IGNORE INTO settings(key,value) SELECT ?,'done' WHERE EXISTS (SELECT 1 FROM submissions WHERE id=? AND user=? AND challenge=? AND submitted=1791090910483)").bind(marker,id,user,challenge)
 ]);
}
