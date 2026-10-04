import {readFile} from 'node:fs/promises';import ts from 'typescript';import assert from 'node:assert/strict';
const source=ts.transpileModule(await readFile('lib/feed-sort.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {sortedPhotos}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const photos=[{id:'a',valid:1,elapsed:10,submitted:300},{id:'b',valid:1,elapsed:20,submitted:100},{id:'c',valid:0,elapsed:1,submitted:200}];
for(const [mode,ids] of [['best',['a','b','c']],['worst',['b','a','c']],['newest',['a','c','b']],['oldest',['b','c','a']]]){const result=sortedPhotos(photos,mode);assert.deepEqual(result.map(p=>p.id),ids);assert.equal(result.find(p=>p.id==='a').place,0);assert.equal(result.find(p=>p.id==='b').place,1);assert.equal(result.find(p=>p.id==='c').place,null)}
assert.deepEqual(photos.map(p=>p.id),['a','b','c']);console.log('PASS: all four feed sorts retain actual placement and keep invalid photos unranked');
