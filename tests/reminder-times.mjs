import {readFile} from 'node:fs/promises';import ts from 'typescript';import assert from 'node:assert/strict';
const code=ts.transpile(await readFile('lib/push-events.ts','utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});const {eventsForChallenge,dailyReminders}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.deepEqual(dailyReminders.map(r=>r.hour),[7,10,14,15,20,22]);
for(const startISO of ['2026-09-26T05:00:00Z','2026-10-25T06:00:00Z','2027-03-28T05:00:00Z']){const start=Date.parse(startISO),c={id:'daily',daily:1,start,end:start+17*3600000,created:start-86400000,title:'secret'};assert.equal(eventsForChallenge(c,start-1800000).length,0);for(const r of dailyReminders){const due=start+(r.hour-7)*3600000;assert.equal(Number(new Intl.DateTimeFormat('en',{hour:'2-digit',hourCycle:'h23',timeZone:'Europe/Oslo'}).format(due)),r.hour);assert.equal(eventsForChallenge(c,due-1).length,0);const event=eventsForChallenge(c,due+500)[0];assert.equal(event.body,r.message);assert.equal(event.kind,r.kind);assert(!JSON.stringify(event).includes('secret'));assert.equal(eventsForChallenge(c,due+900000).length,0)}assert.equal(eventsForChallenge(c,c.end).length,0)}
console.log('PASS: exact reminder texts/times, Oslo summer/winter clocks, no 06:30 message, no secret word, no stale backlog.');
const {seasonAnnouncementTime,seasonStartEvent}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const [start,due] of [
 ['2026-09-30T05:00:00Z','2026-10-01T05:00:00Z'],
 ['2026-10-02T00:00:00Z','2026-10-02T05:00:00Z'],
 ['2026-10-24T10:00:00Z','2026-10-25T06:00:00Z'],
 ['2027-03-27T10:00:00Z','2027-03-28T05:00:00Z']
]){
 const season={id:'season',start:Date.parse(start)},time=Date.parse(due);
 assert.equal(seasonAnnouncementTime(season.start),time);
 const c={id:'day',start:time,end:time+17*3600000};
 assert.equal(seasonStartEvent(c,season,true,time-1),null);
 const event=seasonStartEvent(c,season,true,time);
 assert.equal(event.kind,'season-start');
 assert.match(event.body,/Resultatet fra forrige/);
 assert(!seasonStartEvent(c,season,false,time).body.includes('Resultatet'));
 assert.equal(seasonStartEvent(c,season,true,time+900000),null);
}
console.log('PASS: season announcement at 07 Oslo, rollout, DST, prior result and expiry');

const morning={id:'am',daily:1,slot:1,start:Date.parse('2026-10-02T05:00:00Z'),end:Date.parse('2026-10-02T13:00:00Z'),created:0};
const afternoon={id:'pm',daily:1,slot:2,start:morning.end,end:Date.parse('2026-10-02T22:00:00Z'),created:0};
assert.equal(eventsForChallenge(morning,morning.end).length,0);
assert.equal(eventsForChallenge(afternoon,afternoon.start-1).length,0);
assert.equal(eventsForChallenge(afternoon,afternoon.start)[0].kind,'start-afternoon');
assert.equal(eventsForChallenge(afternoon,afternoon.start+5*3600000)[0].kind,'daily-20');
assert.equal(eventsForChallenge(afternoon,afternoon.end).length,0);
console.log('PASS: morning stops at 15, afternoon starts at 15, reminders follow afternoon slot and stop at midnight');
