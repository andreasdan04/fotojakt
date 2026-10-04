import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.transpileModule(await readFile('lib/daily-words.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {completeWords,NORWEGIAN_WORDS}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const days=Array.from({length:31},(_,i)=>`2027-03-${String(i+1).padStart(2,'0')}`);
const history=[{title:'kopp',day:'2027-02-28'},{title:'glass',day:'2027-04-01'}];
const words=completeWords(Array(31).fill('kopp'),days,history);
assert.equal(words.length,31);
assert(words.every(word=>NORWEGIAN_WORDS.includes(word)));
assert(words.filter(word=>word==='kopp').length===2,'occasional repeats allowed');
for(const [i,word] of words.entries()) {
 assert(words.filter(w=>w===word).length<=2);
 for(let j=0;j<i;j++) if(words[j]===word) assert(i-j>=7);
 for(const old of history) if(old.title===word) assert(Math.abs(Date.parse(days[i])-Date.parse(old.day))/86400000>=7);
}
assert.equal(completeWords(['cup'],[days[0]],[]).length,1);
assert.equal(completeWords([],days,[]).length,31);
assert.deepEqual(completeWords([' SKÅL '],[days[0]],[]),['skål']);
console.log('PASS: 31 days, repair invalid/missing/repeated words, Norwegian bank, occasional repeats and week spacing across albums.');
