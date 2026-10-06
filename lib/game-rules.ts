export const FIRST_LIGHTNING=Date.parse('2026-10-06T17:00:00+02:00');
export const LIGHTNING_DURATION=20*60000;
export const BONUS_REQUIREMENTS=['Bildet inneholder også noe rødt','Bildet inneholder også noe blått','Bildet inneholder også noe rundt'];
export function lightningEvents(c:any,now:number){return [
 {kind:'lightning-warning',due:c.start-1800000,expires:c.start,title:'⚡ Lynjakt om 30 minutter!',body:'Gjør deg klar! Du får 20 minutter når lynjakten starter.'},
 {kind:'lightning-start',due:c.start,expires:c.end,title:'⚡ LYNJAKT!',body:`Finn ${c.title.toLowerCase()} – du har 20 minutter.`}
].filter(e=>e.due<=now&&e.expires>now).map(e=>({...e,key:`${c.id}:${e.kind}`,challenge:c.id,start:c.start}))}
export function bonusVerdict(v:any){if(!v||!['approved','rejected','uncertain'].includes(v.verdict)||typeof v.confidence!=='number'||v.confidence<0||v.confidence>1||typeof v.reason!=='string')return 'manual';return v.verdict==='uncertain'||v.confidence<0.9?'manual':v.verdict}
export function rewardsFrom(photos:any[],a:any,bonusCount:number,now=Date.now()){
 const valid=photos.filter(p=>p.valid),closed=valid.filter(p=>p.end<=now),wins=closed.filter(p=>p.place===1);
 const hour=(p:any)=>Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(p.submitted));
 const titles=[
 ['lightning','Lynjegeren ⚡','Vinn en lynjakt.',wins.some(p=>p.lightning)],
 ['master','Fotomester 📸','Vinn 25 jakter.',wins.length>=25],
 ['speed','Fartsdjevel 💨','Fullfør fem jakter på under 30 sekunder.',valid.filter(p=>p.elapsed<30000).length>=5],
 ['streak','Streak King 🔥','Lever 50 dager på rad.',a.best>=50],
 ['night','Nattugla 🌙','Lever ti bilder etter kl. 22.',valid.filter(p=>hour(p)>=22).length>=10],
 ['veteran','Veteran 🏆','Lever 250 gyldige bilder.',valid.length>=250],
 ['creative','Kreatøren 🎨','Få 25 bonusoppdrag godkjent.',bonusCount>=25]
 ].map(([id,title,description,earned])=>({id,title,description,earned:!!earned}));
 const secrets=[
 ['blink','BLINKSKUDD','Fullfør en jakt på under 10 sekunder.',valid.some(p=>p.elapsed<10000)],
 ['triple','HAT TRICK','Vinn tre jakter på rad.',a.winBest>=3],
 ['last','I SISTE LITEN','Vær sistemann som leverer et gyldig bilde i siste minutt før fristen.',closed.some(p=>p.last&&p.submitted>=p.end-60000&&p.submitted<p.end)],
 ['storm','LYNET SLÅR NED','Vinn en lynjakt.',wins.some(p=>p.lightning)],
 ['rival','RIVALENS MARERITT','Slå samme rival i fem avsluttede jakter.',photos.some(p=>p.rivalWins>=5)]
 ].map(([id,title,description,earned])=>({id,title,description,earned:!!earned}));
 return {titles,secrets};
}
