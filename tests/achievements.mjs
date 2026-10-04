import {readFile} from 'node:fs/promises';import ts from 'typescript';import assert from 'node:assert/strict';
const source=ts.transpileModule(await readFile('lib/achievements.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {achievementsFrom,osloDate}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const start=Date.parse('2027-01-01T12:00:00Z');
const photos=Array.from({length:100},(_,i)=>({valid:1,day:osloDate(start+i*86400000),start:start+i*86400000,end:start+(i+1)*86400000,submitted:start+i*86400000,elapsed:90000,season:i<50?'a':'b',place:i<5?1:2}));
const earned=(a,id)=>a.badges.find(b=>b.id===id).earned;
for(const n of [5,10,25,50,100]){const a=achievementsFrom(photos.slice(0,n),start+(n-1)*86400000);assert.equal(a.best,n);assert.equal(a.current,n);assert(earned(a,'streak-'+n));const before=achievementsFrom(photos.slice(0,n-1),start+(n-1)*86400000);assert(!earned(before,'streak-'+n));}
let a=achievementsFrom([...photos,photos[0]],start+105*86400000);assert.equal(a.best,100);assert.equal(a.current,0);assert(earned(a,'streak-100'));assert(earned(a,'wins-5'));
a=achievementsFrom(photos.filter((_,i)=>i!==50),start+99*86400000);assert.equal(a.best,50);assert.equal(a.current,49);
a=achievementsFrom(photos.map((p,i)=>({...p,valid:i===50?0:1})),start+99*86400000);assert.equal(a.best,50);
assert.equal(osloDate(Date.parse('2027-03-28T22:30:00Z')),'2027-03-29');
a=achievementsFrom([{...photos[0],submitted:Date.parse('2027-01-01T07:00:00Z'),elapsed:59999},{...photos[1],submitted:Date.parse('2027-01-02T21:00:00Z')}],start+2*86400000);assert(earned(a,'early'));assert(earned(a,'late'));assert(earned(a,'fast'));
a=achievementsFrom([{...photos[0],elapsed:60000,end:start+86400000,place:1}],start);assert(!earned(a,'fast'));assert(!earned(a,'winner'));
assert.equal(achievementsFrom([],start).best,0);console.log('PASS: all streak thresholds, calendar gaps, duplicates, invalid photos, cross-season/DST streak, earned retention, timing and win boundaries');

const hunts=[{start:1,end:2,valid:1},{start:3,end:4,valid:1},{start:5,end:6,valid:0},{start:7,end:8,valid:1},{start:9,end:20,valid:0}];
assert.equal(achievementsFrom([],10,hunts).huntCurrent,1);assert.equal(achievementsFrom([],10,hunts).huntBest,2);assert.equal(achievementsFrom([],21,hunts).huntCurrent,0);
assert(achievementsFrom([],100,Array.from({length:5},(_,i)=>({start:i*2,end:i*2+1,valid:1}))).badges.find(b=>b.id==='hunt-streak-5').earned);
const winHunts=Array.from({length:6},(_,i)=>({id:'h'+i,start:100+i*10,end:105+i*10,valid:1}));
const winPhotos=winHunts.map(h=>({challenge:h.id,start:h.start,end:h.end,valid:1,place:1,submitted:h.end,elapsed:10000,season:'a'}));
let streakWins=achievementsFrom(winPhotos,200,winHunts);assert.equal(streakWins.winCurrent,6);assert.equal(streakWins.winBest,6);assert(earned(streakWins,'win-streak-3'));assert(earned(streakWins,'win-streak-5'));assert(!earned(streakWins,'win-streak-10'));
streakWins=achievementsFrom(winPhotos.map((p,i)=>({...p,place:i===3?2:1})),200,winHunts);assert.equal(streakWins.winCurrent,2);assert.equal(streakWins.winBest,3);
streakWins=achievementsFrom(winPhotos.slice(0,5),200,winHunts);assert.equal(streakWins.winCurrent,0);assert.equal(streakWins.winBest,5);assert(earned(streakWins,'win-streak-5'));
streakWins=achievementsFrom(winPhotos,150,winHunts);assert.equal(streakWins.winCurrent,5);assert(!earned(streakWins,'win-streak-10'));
assert(earned(achievementsFrom([{...winPhotos[0],slot:1,day:'2026-10-02'},{...winPhotos[1],slot:2,day:'2026-10-02'}],200),'double-day'));
assert(!earned(achievementsFrom([{...winPhotos[0],slot:1,day:'2026-10-02'},{...winPhotos[1],slot:2,day:'2026-10-03'}],200),'double-day'));
console.log('PASS: consecutive wins, loss/missed hunt breaks, ended-only wins, retained best streak, and both daily slots');
