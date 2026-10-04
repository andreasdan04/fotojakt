export const osloDate=(n:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo',year:'numeric',month:'2-digit',day:'2-digit'}).format(n);
const dayIndex=(day:string)=>Date.parse(day+'T12:00:00Z')/86400000;
export function achievementsFrom(photos:any[],now:number,hunts:any[] = []){
 const valid=photos.filter(p=>p.valid===1&&p.start<=now);
 const days=[...new Set(valid.map(p=>p.day||osloDate(p.start)))].sort();
 let streak=0,best=0,previous=-Infinity;
 for(const day of days){const value=dayIndex(day);streak=value===previous+1?streak+1:1;best=Math.max(best,streak);previous=value}
 const current=previous>=dayIndex(osloDate(now))-1?streak:0;
 const wins=valid.filter(p=>p.end<=now&&p.place===1).length;
 const hour=(p:any)=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(p.submitted));
 let huntCurrent=0,huntBest=0;
 for(const hunt of [...hunts].sort((a,b)=>a.start-b.start)){if(hunt.valid){huntCurrent++;huntBest=Math.max(huntBest,huntCurrent)}else if(hunt.end<=now)huntCurrent=0;}
 let winCurrent=0,winBest=0;
 const closedHunts=(hunts.length?hunts:valid).filter(h=>h.end<=now).sort((a,b)=>a.start-b.start);
 for(const hunt of closedHunts){const photo=valid.find(p=>hunt.id?p.challenge===hunt.id:p.start===hunt.start);if(photo?.place===1){winCurrent++;winBest=Math.max(winBest,winCurrent)}else winCurrent=0;}
 const badges:any[]=[];
 const add=(id:string,title:string,icon:string,description:string,value:number,target:number)=>badges.push({id,title,icon,description,earned:value>=target,progress:Math.min(value,target),target});
 for(const goal of [5,10,25,50,100])add('streak-'+goal,goal+' dager på rad','🔥','Lever et gyldig bilde på '+goal+' sammenhengende kalenderdager.',best,goal);
 for(const goal of [5,10,25,50,100])add('hunt-streak-'+goal,goal+' jakter på rad','⚡','Fullfør '+goal+' påfølgende jakter med gyldig bilde.',huntBest,goal);
 add('first-photo','Første blinkskudd','📸','Lever ditt første gyldige bilde.',valid.length,1);
 add('photos-25','Fotoentusiast','🎞️','Lever 25 gyldige bilder.',valid.length,25);
 add('photos-100','Hundre blinkskudd','💯','Lever 100 gyldige bilder.',valid.length,100);
 add('fast','Lynfotograf','⚡','Fullfør en jakt på under ett minutt.',valid.some(p=>p.elapsed<60000)?1:0,1);
 add('early','Morgenfugl','🌅','Lever et gyldig bilde før kl. 09.00 norsk tid.',valid.some(p=>hour(p)<9)?1:0,1);
 add('late','Nattugle','🦉','Lever et gyldig bilde fra kl. 22.00 norsk tid.',valid.some(p=>hour(p)>=22)?1:0,1);
 add('winner','Første seier','🏆','Vinn en avsluttet jakt.',wins,1);
 add('wins-5','Fem seire','⭐','Vinn fem jakter – de trenger ikke være på rad.',wins,5);
 for(const goal of [3,5,10])add('win-streak-'+goal,goal+' seire på rad','👑','Vinn '+goal+' påfølgende avsluttede jakter blant dine venner og grupper. En tapt eller ikke levert jakt bryter rekken.',winBest,goal);
 for(const goal of [10,25,50])add('wins-'+goal,goal+' seire','🏆','Vinn '+goal+' avsluttede jakter totalt.',wins,goal);
 for(const goal of [10,50,250])add('photos-'+goal,goal+' blinkskudd','📷','Lever '+goal+' gyldige bilder.',valid.length,goal);
 const podiums=valid.filter(p=>p.end<=now&&p.place>=1&&p.place<=3).length;
 for(const goal of [5,25])add('podiums-'+goal,goal+' pallplasser','🥇','Kom blant de tre beste i '+goal+' avsluttede jakter.',podiums,goal);
 const doubles=new Map<string,number>();for(const p of valid)if(p.slot===1||p.slot===2){const day=p.day||osloDate(p.start);doubles.set(day,(doubles.get(day)||0)|(p.slot===1?1:2));}
 add('double-day','Dobbeljeger','🎯','Lever et gyldig bilde i begge dagsjaktene på samme dag.',[...doubles.values()].some(v=>v===3)?1:0,1);
 add('seasons-3','Fast på laget','💙','Lever gyldige bilder i tre ulike sesonger.',new Set(valid.map(p=>p.season)).size,3);
 return {current,best,huntCurrent,huntBest,winCurrent,winBest,badges};
}
