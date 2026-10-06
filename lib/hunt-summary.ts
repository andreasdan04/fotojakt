import {rank,all} from './server';
import {groupAudienceSql} from './groups';
import {osloDay} from './daily';
const ordered=(photos:any[],id:string)=>photos.filter(s=>s.challenge===id&&s.valid).sort((a,b)=>a.elapsed-b.elapsed||a.submitted-b.submitted||a.id.localeCompare(b.id));
const points=(place:number)=>place<0?0:Math.max(1,[10,7,5,3,2][place]||1);
export function huntSummaries(hunts:any[],photos:any[],members:any[],user:string,now:number){
 return hunts.filter(c=>c.start&&c.end<=now).map(c=>{const list=ordered(photos,c.id),place=list.findIndex(s=>s.user===user);const before=rank(hunts,photos.filter(s=>s.submitted<c.end),members,c.end-1),after=rank(hunts,photos.filter(s=>s.submitted<=c.end),members,c.end);const b=before.findIndex(r=>r.id===user),a=after.findIndex(r=>r.id===user);return {id:c.id,title:c.title,end:c.end,winner:list[0]?{id:list[0].id,name:list[0].name||members.find(m=>m.id===list[0].user)?.name,elapsed:list[0].elapsed}:null,points:place<0?0:c.id.startsWith('lightning:')?(place===0?3:1):points(place)+(list[place]?.bonus_points||0),place:place<0?null:place+1,before:b<0?null:b+1,after:a<0?null:a+1,change:b<0||a<0?null:b-a}}).sort((a,b)=>b.end-a.end);
}
export async function seasonSummaries(user:string,now:number){
 const seasons=await all('SELECT DISTINCT a.* FROM seasons a JOIN challenges c ON c.season=a.id JOIN submissions s ON s.challenge=c.id WHERE s.user=? ORDER BY a.start DESC',user);
 const members=await all(`SELECT m.id,m.name,m.approved FROM members m WHERE m.status='approved' AND ${groupAudienceSql(user,'m.id')}`);
 const result=[];
 for(const season of seasons.filter((s:any)=>s.end&&s.end<=now||s.last_day&&s.last_day<osloDay(now))){
  const hunts=await all('SELECT * FROM challenges WHERE season=? AND start IS NOT NULL AND end<=? ORDER BY start,id',season.id,now);
  const raw=await all(`SELECT s.*,m.name,CASE WHEN b.status='approved' THEN 2 ELSE 0 END bonus_points FROM submissions s LEFT JOIN bonus_reviews b ON b.submission=s.id JOIN members m ON m.id=s.user JOIN challenges c ON c.id=s.challenge WHERE c.season=?`,season.id);
  const photos=raw.filter((p:any)=>members.some((m:any)=>m.id===p.user)),own=photos.filter((p:any)=>p.user===user&&p.valid&&hunts.some((c:any)=>c.id===p.challenge));
  let streak=0,longest=0,bestPlace:number|null=null,wins=0;
  for(const hunt of hunts){if(!hunt.id.startsWith('lightning:')){if(own.some((p:any)=>p.challenge===hunt.id)){streak++;longest=Math.max(longest,streak)}else if(hunt.end>members.find((m:any)=>m.id===user)?.approved)streak=0;}
   if(ordered(photos,hunt.id)[0]?.user===user)wins++;
   const table=rank(hunts,photos.filter((s:any)=>s.submitted<=hunt.end),members,hunt.end),i=table.findIndex(r=>r.id===user);if(i>=0&&table[i].done>0)bestPlace=bestPlace===null?i+1:Math.min(bestPlace,i+1);
  }
  const fastest=[...own].sort((a,b)=>a.elapsed-b.elapsed||a.submitted-b.submitted)[0];
  const popular=await all('SELECT s.id,s.caption,c.title,COUNT(r.id) reactions FROM submissions s JOIN challenges c ON c.id=s.challenge LEFT JOIN reactions r ON r.submission=s.id WHERE s.user=? AND c.season=? AND s.valid=1 AND c.end<=? GROUP BY s.id ORDER BY reactions DESC,s.submitted,s.id LIMIT 1',user,season.id,now);
  const table=rank(hunts,photos,members,now),i=table.findIndex(r=>r.id===user);
  result.push({id:season.id,name:season.name,bestPlace,finalPlace:i>=0&&own.length?i+1:null,points:table[i]?.points||0,wins,longest,fastest:fastest?{id:fastest.id,elapsed:fastest.elapsed,title:hunts.find((c:any)=>c.id===fastest.challenge)?.title}:null,popular:popular[0]||null});
 }
 return result;
}
