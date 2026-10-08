import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
let mono=100,wall=100000,origin=1;
const exports={};vm.runInNewContext(ts.transpileModule(await readFile('lib/hunt-clock.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,performance:{now:()=>mono,get timeOrigin(){return origin}},Date:{now:()=>wall},Number,Error});
const {anchorClock,clockNow}=exports,server=Date.parse('2026-10-08T14:30:00Z');
let anchor=anchorClock(server);mono+=23583;wall+=23583;assert.equal(clockNow(anchor)-server,23583);
for(const jump of [3600000,-86400000,365*86400000]){wall+=jump;assert.equal(clockNow(anchor)-server,23583,'device date/timezone changes never affect elapsed time');}
const persisted=JSON.parse(JSON.stringify(anchor));mono+=7000;assert.equal(clockNow(persisted)-server,30583,'cached camera lease retains monotonic time in the same page');
// Across page restarts, only a nonnegative wall interval is available offline.
origin=2;wall=persisted.wall+120000;assert.equal(clockNow(persisted)-server,120000);wall=persisted.wall-1;assert.throws(()=>clockNow(persisted),/Enhetsklokken er endret/);
anchor=anchorClock(server+120000);mono+=234;assert.equal(clockNow(anchor),server+120234,'online refresh reanchors without device clock skew');
const labels={};vm.runInNewContext(ts.transpileModule(await readFile('lib/staff-labels.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:labels});
for(const role of ['owner','administrator','head_judge','judge'])assert.equal(labels.isStaffRole(role),true);for(const role of ['player',undefined,null,'fake'])assert.equal(labels.isStaffRole(role),false);
const source=await readFile('app/hunt.tsx','utf8');assert(source.includes('isStaffRole(data.adminAccess?.role)&&<a'));assert(source.includes('j.title,details:j.details,started:j.started'),'word comes directly from the server start response');assert(source.includes('viewGeneration.current++'),'old polling responses cannot hide the newly opened word');
console.log('PASS: server/monotonic timing, wrong phone date/timezone, cached lease, offline restart guard, online reanchor, all staff navigation roles and immediate start flow.');
