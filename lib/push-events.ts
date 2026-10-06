import {lightningEvents} from './game-rules';
export const dailyReminders=[
 {hour:6,kind:'start',message:'Formiddagens ord er klart. Start når det passer – lever før kl. 15.00.'},
 {hour:10,kind:'daily-10',message:'Lyst på en fotojakt? Formiddagens oppgave er åpen til kl. 15.00.'},
 {hour:14,kind:'daily-14',message:'Én time igjen av formiddagsjakten. Lever før kl. 15.00.'},
 {hour:15,kind:'start-afternoon',message:'Ettermiddagens ord er klart. Du har frem til kl. 00.00.'},
 {hour:20,kind:'daily-20',message:'Ettermiddagsjakten er fortsatt åpen. Lever før kl. 00.00.'},
 {hour:22,kind:'daily-22',message:'To timer igjen av ettermiddagsjakten. Siste påminnelse i dag.'}
] as const;
// Pure event planning; times are server timestamps, never client-provided.
export function eventsForChallenge(c:any,now:number){
 if(!c.start||c.end<=now)return [];
 if(c.id.startsWith('lightning:'))return lightningEvents(c,now);
 // Daily starts are stored at 06:00 Europe/Oslo. All reminders are later on
 // that same local day, after the DST transition (which occurs before 06:00).
 if(c.daily)return dailyReminders.map(r=>{const startHour=c.slot===2?15:6;const due=c.start+(r.hour-startHour)*3600000;return {kind:r.kind,due,expires:Math.min(c.end,due+900000),title:'📸 Foto Jakt',body:r.message,key:`${c.id}:${c.start}:${r.kind}`,challenge:c.id,start:c.start}}).filter(e=>e.due>=c.start&&e.due>=c.created&&e.due<c.end&&e.due<=now&&e.expires>now);

 const clock=new Date(c.start).toLocaleString('nb-NO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'});
 const events=[
  {kind:'ready',due:c.created,expires:c.start,title:'📸 Neste fotojakt er klar',body:`Start ${clock}. Åpne appen for nedtelling. Ordet er hemmelig til du selv starter.`,enabled:!c.daily&&c.start>c.created+60000},
  {kind:'reminder',due:c.start-1800000,expires:c.start,title:'⏰ Fotojakt om 30 minutter',body:`Gjør deg klar! Neste jakt starter ${clock}.`,enabled:c.start-c.created>=1800000},
  {kind:'start',due:c.start,expires:Math.min(c.end,c.start+900000),title:c.daily?'📸 Dagens ord er klart!':'🚨 Foto Jakt har startet!',body:c.daily?'Dagens ord er klart. Start når det passer deg – din klokke går først når du viser ordet.':c.title,enabled:true}
 ];
 return events.filter(e=>e.enabled&&e.due<=now&&e.expires>now).map(e=>({...e,key:`${c.id}:${c.start}:${e.kind}`,challenge:c.id,start:c.start}));
}

// Existing season receives the new announcement on the first morning after rollout.
export const seasonAnnouncementRollout=Date.parse('2026-10-01T04:00:00Z');
export function seasonAnnouncementTime(start:number){
 const earliest=Math.max(start,seasonAnnouncementRollout);
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(earliest);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 const local=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z');
 const offset=local-Math.floor(earliest/1000)*1000;
 let target=Date.parse(p.year+'-'+p.month+'-'+p.day+'T06:00:00Z');
 if(target<local)target+=86400000;
 // Recalculate the offset at the target date, including DST changes overnight.
 let value=target-offset;
 for(let i=0;i<3;i++){
  const q=Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(value).map(x=>[x.type,x.value]));
  value+=target-Date.parse(q.year+'-'+q.month+'-'+q.day+'T'+q.hour+':'+q.minute+':'+q.second+'Z');
 }
 return value;
}
export function seasonStartEvent(c:any,season:any,hasPrevious:boolean,now:number){
 const due=seasonAnnouncementTime(season.start);
 if(now<due||now>=due+900000||c.start>due||c.end<=now)return null;
 return {kind:'season-start',due,expires:Math.min(c.end,due+900000),title:'🎉 Ny fotojakt er i gang!',body:hasPrevious?'🏆 Resultatet fra forrige fotojakt er klart! Se hvem som vant, les reglene og bli med på den nye jakten.':'En ny fotojakt er i gang! Åpne appen, les reglene og bli med.',key:'season:'+season.id+':morning',challenge:c.id,start:c.start};
}
