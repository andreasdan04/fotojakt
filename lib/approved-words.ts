import {describeWords} from './word-descriptions';
import {all,db,run} from './server';
import {normalizeWord} from './daily-words';
import {APPROVED_WORD_SQL} from './word-box';
// Use each approved suggestion once, only in an unopened future morning hunt.
// Persist usage separately so repeated page loads and timer ticks are idempotent.
export async function applyApprovedWords(now=Date.now()){
 const suggestions=await all(`SELECT DISTINCT word FROM word_suggestions WHERE ${APPROVED_WORD_SQL} ORDER BY created`);
 if(!suggestions.length)return {count:0};
 const used=await all("SELECT key FROM settings WHERE key LIKE 'approved-word-used:%'");const usedKeys=new Set(used.map((s:any)=>s.key));
 const history=await all('SELECT title FROM challenges');const existing=new Set(history.map((c:any)=>normalizeWord(c.title)));
 const words=[...new Set<string>(suggestions.map((s:any)=>normalizeWord(s.word)))].filter(w=>!existing.has(w)&&!usedKeys.has('approved-word-used:'+w)).slice(0,8);
 if(!words.length)return {count:0};
 const descriptions=await describeWords(words);const lease=String(now+30000),lock=await run("INSERT INTO settings(key,value) VALUES('approved-word-lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<?",lease,now);if(!lock.meta.changes)return {count:0};
 try{
 const future=await all("SELECT c.id,c.title,c.day FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.daily=1 AND c.slot=1 AND c.start>? AND s.end IS NULL AND NOT EXISTS(SELECT 1 FROM settings WHERE key LIKE 'approved-word-used:%' AND value=c.id) AND NOT EXISTS(SELECT 1 FROM starts WHERE challenge=c.id) AND NOT EXISTS(SELECT 1 FROM submissions WHERE challenge=c.id) ORDER BY c.start",now+3600000);
 const days=new Set<string>(),selected=future.filter((c:any)=>{if(days.has(c.day))return false;days.add(c.day);return true});let count=0;
 for(const [i,word] of words.entries()){
  const hunt=selected[i];if(!hunt)break;const key='approved-word-used:'+word,d=db(),cutoff=Date.now()+3600000;
  const results=await d.batch([
   d.prepare(`INSERT INTO settings(key,value) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM settings WHERE key=?) AND NOT EXISTS(SELECT 1 FROM challenges WHERE lower(trim(title))=?) AND EXISTS(SELECT 1 FROM word_suggestions WHERE word=? AND ${APPROVED_WORD_SQL}) AND EXISTS(SELECT 1 FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND c.title=? AND c.start>? AND s.end IS NULL AND NOT EXISTS(SELECT 1 FROM settings WHERE key LIKE 'approved-word-used:%' AND value=c.id) AND NOT EXISTS(SELECT 1 FROM starts WHERE challenge=c.id) AND NOT EXISTS(SELECT 1 FROM submissions WHERE challenge=c.id))`).bind(key,hunt.id,key,word,word,hunt.id,hunt.title,cutoff),
   d.prepare('UPDATE challenges SET title=?,details=? WHERE id=? AND title=? AND EXISTS(SELECT 1 FROM settings WHERE key=? AND value=?)').bind(word,descriptions[word],hunt.id,hunt.title,key,hunt.id)
  ]);count+=results[1].meta.changes||0;
 }
 return {count};
 }finally{await run("UPDATE settings SET value='0' WHERE key='approved-word-lock' AND value=?",lease)}
}
