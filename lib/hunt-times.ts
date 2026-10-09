export const osloDay=(time:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
export function osloTime(day:string,hour:number){const target=Date.parse(day+'T'+String(hour).padStart(2,'0')+':00:00Z');let value=target;for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));value+=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)}return value}
export const nextDay=(day:string)=>new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
export function huntWindow(day:string,slot:number){return {start:osloTime(day,slot===2?14:6),end:slot===2?osloTime(nextDay(day),0):osloTime(day,17)}}
// Existing afternoon attempts can continue through rollout or a morning retake.
export function afternoonLocked(c:any,challenges:any[],submissions:any[],user:string,now:number,attempt?:any){
 if(!c.daily||c.slot!==2||attempt||submissions.some(s=>s.challenge===c.id&&s.user===user))return false;
 const morning=challenges.find(m=>m.daily&&m.slot===1&&m.day===c.day&&m.season===c.season);
 return !!morning&&now<osloTime(c.day,17)&&!submissions.some(s=>s.challenge===morning.id&&s.user===user);
}
export function orderHunts(challenges:any[]){
 const ordered=[...challenges].sort((a,b)=>Number(!!a.locked)-Number(!!b.locked)||Number(!!a.own)-Number(!!b.own)||Number(!!b.lightning)-Number(!!a.lightning)||a.start-b.start);
 // Keep overlapping daily cards in a fixed order, even when the afternoon
 // card is locked or completed. Availability never changes which word is on top.
 for(const afternoon of challenges.filter(c=>c.daily&&c.slot===2)){
  const morning=ordered.find(c=>c.daily&&c.slot===1&&c.day===afternoon.day&&c.season===afternoon.season&&c.start<afternoon.end&&afternoon.start<c.end);
  if(!morning)continue;
  const morningIndex=ordered.indexOf(morning),afternoonIndex=ordered.indexOf(afternoon);
  if(afternoonIndex>morningIndex){ordered.splice(afternoonIndex,1);ordered.splice(morningIndex,0,afternoon);}
 }
 return ordered;
}
