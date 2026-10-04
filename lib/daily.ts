import {describeWords,genericDescription} from './word-descriptions';
import {wordMeaning} from './word-meanings';
import {approvedWordBank} from './word-box';
import {NORWEGIAN_WORDS,allowedWords,completeWords} from './daily-words';
import {env} from 'cloudflare:workers';
import {all,one,run,db,fail,str} from './server';
export const osloDay=(time:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
export function osloTime(day:string,hour:number){const target=Date.parse(day+'T'+String(hour).padStart(2,'0')+':00:00Z');let value=target;for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));value+=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)}return value}
export const nextDay=(day:string)=>new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
export async function createAlbum(b:any){
 const name=str(b.name,70),first=str(b.first,10),last=str(b.last,10),now=Date.now();
 for(const day of [first,last])if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)fail('Velg gyldige datoer.');
 if(first<osloDay(now)||last<first)fail('Albumet må starte i dag eller senere, og slutte etter startdatoen.');
 const days:string[]=[];for(let day=first;day<=last;day=nextDay(day)){days.push(day);if(days.length>31)fail('Velg maksimalt 31 dager per album.');}
 const key=(env as any).OPENAI_API_KEY;if(!key)fail('AI-nøkkelen mangler. Kontakt Andreas.',503);
 if(await one('SELECT id FROM challenges WHERE daily=1 AND day BETWEEN ? AND ? LIMIT 1',first,last))fail('Et annet album har allerede ord på disse datoene. Velg andre dager.');
 const lease=String(now+120000);const lock=await run("INSERT INTO settings(key,value) VALUES ('ai_album_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<?",lease,now);if(!lock.meta.changes)fail('AI lager allerede et album. Vent litt.',409);
 try{
 const slots=days.flatMap(day=>[{day,slot:1},{day,slot:2}]);
 const words=await generateWords(slots.map(x=>x.day),await all('SELECT title,day FROM challenges WHERE daily=1'),slots.map(x=>x.slot===2));
 const descriptions=await describeWords(words);const id=crypto.randomUUID(),d=db();const statements=[d.prepare('INSERT INTO seasons(id,name,start,daily,first_day,last_day) VALUES (?,?,?,1,?,?)').bind(id,name,osloTime(first,7),first,last)];
 slots.forEach(({day,slot},i)=>{const start=osloTime(day,slot===1?7:15),end=slot===1?osloTime(day,15):osloTime(nextDay(day),0);statements.push(d.prepare('INSERT INTO challenges(id,season,title,details,start,end,duration,created,daily,day,slot) VALUES (?,?,?,?,?,?,?,?,1,?,?)').bind(crypto.randomUUID(),id,words[i],descriptions[words[i]],start,end,end-start,now,day,slot))});
 try{await d.batch(statements)}catch{fail('Datoene ble opptatt av et annet album. Last siden på nytt.',409)}return {ok:true,id,days:days.length};
 }finally{await run("UPDATE settings SET value='0' WHERE key='ai_album_lock' AND value=?",lease)}
}
export async function startDaily(id:string,m:any){const now=Date.now();const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND c.daily=1 AND s.end IS NULL AND c.start<=? AND c.end>?',id,now,now);if(!c)fail('Dagens ord er ikke åpent. Nye jakter åpner kl. 07.00 og 15.00 norsk tid.');if(!m.admin&&!await one('SELECT id FROM push_subscriptions WHERE user=? LIMIT 1',m.id))fail('Aktiver varsler før du starter.');await run('INSERT OR IGNORE INTO starts(challenge,user,started) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM challenges WHERE id=? AND revision=?)',id,m.id,now,id,c.revision);const attempt=await one('SELECT started FROM starts WHERE challenge=? AND user=?',id,m.id);if(!attempt)fail('Oppgaven er slettet.');if((await one('SELECT revision FROM challenges WHERE id=?',id))?.revision!==c.revision)fail('Jaktordet er byttet. Start på nytt.',409);return {ok:true,title:c.title,details:c.details,started:attempt.started};}

async function generateWords(days:string[],previous:any[],movement:boolean[]){
 const bank=[...new Set([...NORWEGIAN_WORDS,...await approvedWordBank()])];
 const key=(env as any).OPENAI_API_KEY;if(!key)fail('AI-nøkkelen mangler.',503);
 let response:Response;try{response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,messages:[{role:'system',content:'Du lager norsk fotokonkurranse for familier på Vestvågøy i Lofoten. Returner nøyaktig ett konkret motiv per jakt, to jakter per dag. Motivet kan være ett ord eller et allerede godkjent kort uttrykk fra ordkassen. Velg vanlige gjenstander, husdyr, lett observerbare vanlige dyr, planter eller naturting som faktisk finnes og er lett tilgjengelige på Vestvågøy i aktuell årstid. Velg en blanding av ting hjemme og ting som krever at man beveger seg ut i nærmiljøet. Minst ettermiddagsjakten skal være noe ute, som benk, postkasse, gjerde, bark, stein eller skilt. Ingen bilkjøring eller lang tur skal være nødvendig. Ikke eksotiske dyr, sjeldne arter, abstrakte ord, egennavn, oppgaver som krever kjøp, farlig ferdsel, dyreplaging eller privat adgang. Bruk kun forslag fra allowedForDate for den aktuelle datoen. Banken inneholder norske ord, korte uttrykk som gult hus og vanlige låneord som laptop, samt forslag eksplisitt godkjent av admin. Ikke avvis et alternativ i banken bare fordi det inneholder mellomrom eller har engelsk opprinnelse. Varier kategoriene og velg gjerne nye ord. Ord kan gjentas av og til, med minst 7 dager mellom og maksimalt to ganger i samme album. Prioriter variasjon. Ingen persondata. Ikke velg spesifikke lokasjoner.'},{role:'user',content:JSON.stringify({dates:days,allowedForDate:days.map(day=>({day,words:allowedWords(day,previous,bank)}))})}],response_format:{type:'json_schema',json_schema:{name:'daily_words',strict:true,schema:{type:'object',properties:{words:{type:'array',items:{type:'string',enum:bank}}},required:['words'],additionalProperties:false}}},max_completion_tokens:4000})})}catch{fail('AI svarte ikke i tide. Prøv igjen. Albumet er ikke opprettet.',502)}
 if(!response!.ok){await response!.body?.cancel();fail(response!.status===401?'AI-nøkkelen er ugyldig. Legg inn en ny nøkkel.':response!.status===429?'AI-kontoen har nådd en grense eller mangler saldo. Sjekk API-kontoen og prøv igjen.':'AI kunne ikke lage albumet. Prøv igjen senere.',502)}
 let words:any;try{const data:any=await response!.json();words=JSON.parse(data.choices[0].message.content).words}catch{fail('AI returnerte et ugyldig svar. Prøv igjen.',502)}
 return completeWords(words,days,previous,movement,bank);

}

// Upgrade only unreleased legacy days. Existing starts, photos and deadlines stay intact.
export async function upgradeFutureDaily(now=Date.now()){
 const rows=await all('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.daily=1 AND c.day IS NOT NULL AND c.slot=0 AND c.start>? AND s.end IS NULL ORDER BY c.start',now);
 if(!rows.length)return;
 const history=await all('SELECT title,day FROM challenges WHERE daily=1');
 const words=completeWords([],rows.map((r:any)=>r.day),history,rows.map(()=>true));
 const d=db(),q:any[]=[];
 rows.forEach((r:any,i:number)=>{const middle=osloTime(r.day,15);
 q.push(d.prepare("INSERT OR IGNORE INTO challenges(id,season,title,details,start,end,duration,created,daily,day,slot) SELECT ?,season,?,?,?,end,end-?, ?,1,day,2 FROM challenges WHERE id=? AND slot=0 AND start>?").bind(crypto.randomUUID(),words[i],wordMeaning(words[i])||genericDescription(words[i]),middle,middle,now,r.id,now));
 q.push(d.prepare('UPDATE challenges SET end=?,duration=?-start,slot=1 WHERE id=? AND slot=0 AND start>?').bind(middle,middle,r.id,now));
 });await d.batch(q);
}
export async function refreshFutureWords(){
 await upgradeFutureDaily();const now=Date.now(),lease=String(now+120000);
 const lock=await run("INSERT INTO settings(key,value) VALUES ('ai_album_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<?",lease,now);
 if(!lock.meta.changes)fail('AI jobber allerede. Vent litt.',409);
 try{
 const rows=await all('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.daily=1 AND c.start>? AND s.end IS NULL ORDER BY c.start',now);
 if(!rows.length)fail('Det er ingen fremtidige ord å oppdatere.');
 const history=await all('SELECT title,day FROM challenges WHERE daily=1');
 const selected:any[]=[];const words:string[]=[];
 // Bound each AI request to one month. Nothing is written until all batches succeed.
 for(let i=0;i<rows.length;i+=62){const part=rows.slice(i,i+62);const next=await generateWords(part.map((r:any)=>r.day),[...history,...selected],part.map((r:any)=>r.slot===2));words.push(...next);part.forEach((r:any,j:number)=>selected.push({day:r.day,title:next[j]}));}
 const descriptions=await describeWords(words);const cutoff=Date.now(),d=db();const results=await d.batch(rows.map((r:any,i:number)=>d.prepare('UPDATE challenges SET title=?,details=? WHERE id=? AND title=? AND start>? AND NOT EXISTS (SELECT 1 FROM starts WHERE challenge=?) AND season IN (SELECT id FROM seasons WHERE end IS NULL)').bind(words[i],descriptions[words[i]],r.id,r.title,cutoff,r.id)));
 return {ok:true,count:results.reduce((n:number,r:any)=>n+(r.meta.changes||0),0)};
 }finally{await run("UPDATE settings SET value='0' WHERE key='ai_album_lock' AND value=?",lease)}
}
