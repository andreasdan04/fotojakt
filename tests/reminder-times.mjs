import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild'),dir=await mkdtemp(tmpdir()+'/foto-reminders-');
await build({entryPoints:['lib/push-events.ts','lib/hunt-times.ts'],outdir:dir,bundle:true,platform:'node',format:'esm'});
const {eventsForChallenge,dailyReminders,seasonAnnouncementTime,seasonStartEvent}=await import(dir+'/push-events.js'),{osloTime,huntWindow}=await import(dir+'/hunt-times.js');
assert.deepEqual(dailyReminders.map(r=>r.hour),[7,10,16,14,17,20,22]);
for(const day of ['2026-10-08','2026-10-25','2027-03-28'])for(const slot of [1,2]){
 const c={id:'day'+slot,daily:1,slot,day,...huntWindow(day,slot),created:0,title:'SECRET'};
 assert.equal(eventsForChallenge(c,osloTime(day,6)).length,0);
 for(const r of dailyReminders.filter(r=>r.slot===slot)){
  const due=osloTime(day,r.hour);assert.equal(eventsForChallenge(c,due-1).length,0);
  const [event]=eventsForChallenge(c,due);assert.equal(event.kind,r.kind);assert.equal(event.body,r.message);assert(!JSON.stringify(event).includes('SECRET'));
  assert.equal(eventsForChallenge(c,due+900000).length,0);
 }
 assert.equal(eventsForChallenge(c,c.end).length,0);
}
for(const [start,due] of [['2026-09-30T04:00:00Z','2026-10-01T05:00:00Z'],['2026-10-24T10:00:00Z','2026-10-25T06:00:00Z'],['2027-03-27T10:00:00Z','2027-03-28T05:00:00Z']]){
 const season={id:'s',start:Date.parse(start)},time=Date.parse(due);assert.equal(seasonAnnouncementTime(season.start),time);const c={id:'am',start:time-3600000,end:time+36000000};assert.equal(seasonStartEvent(c,season,true,time-1),null);assert.equal(seasonStartEvent(c,season,true,time).kind,'season-start');assert.equal(seasonStartEvent(c,season,true,time+900000),null);
}
console.log('PASS: exact morning/afternoon reminder times, no 06 message, Oslo summer/winter/DST, expiry, hidden words and season announcement at 07.');
