import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild'),dir=mkdtempSync(tmpdir()+'/foto-upload-race-');
const server=`export const db=()=>globalThis.fixture.db,bucket=()=>globalThis.fixture.bucket;export const str=(v,n=150)=>{if(typeof v!=='string'||!v.trim()||v.length>n)throw Error('Invalid text');return v.trim()};export const all=async(q,...args)=>globalThis.fixture.sql.prepare(q).all(...args);export const one=async(q,...args)=>globalThis.fixture.sql.prepare(q).get(...args)||null;export const run=async(q,...args)=>({meta:{changes:Number(globalThis.fixture.sql.prepare(q).run(...args).changes)}});export const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};export const json=Response.json;`;
await build({entryPoints:['lib/upload-photo-server.ts','lib/image-privacy.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',plugins:[{name:'fixture',setup(b){b.onLoad({filter:/\/lib\/server\.ts$/},()=>({contents:server,loader:'ts'}));b.onLoad({filter:/\/lib\/daily\.ts$/},()=>({contents:'export async function upgradeHuntWindows(){}'}));b.onLoad({filter:/\/lib\/daily-access\.ts$/},()=>({contents:'export async function requireDailyAccess(){}'}));b.onLoad({filter:/\/lib\/usage\.ts$/},()=>({contents:'export async function recordUsage(){}'}));}}]});
const sql=new DatabaseSync(':memory:');for(const e of JSON.parse(readFileSync('drizzle/meta/_journal.json')).entries)sql.exec(readFileSync('drizzle/'+e.tag+'.sql','utf8').replaceAll('--> statement-breakpoint',''));
const prepare=q=>({bind(...args){return {run:()=>({meta:{changes:Number(sql.prepare(q).run(...args).changes)}})}}});
const db={prepare,batch:async list=>{sql.exec('BEGIN');try{const results=[];for(const statement of list)results.push(statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}};
const objects=new Map();let puts=0,release;const barrier=new Promise(resolve=>{release=resolve});
const bucket={put:async(key,bytes)=>{objects.set(key,new Uint8Array(bytes));if(++puts===2)release();await barrier},delete:async key=>objects.delete(key)};
globalThis.fixture={db,sql,bucket};
const {uploadPhoto}=await import(dir+'/upload-photo-server.js'),{stripImageMetadata}=await import(dir+'/image-privacy.js'),now=Date.now(),started=now-60000;
sql.prepare("INSERT INTO seasons(id,name,start) VALUES('s','Test',1)").run();sql.prepare("INSERT INTO challenges(id,season,title,start,end,duration,created,daily) VALUES('h','s','kopp',?,?,3600000,1,1)").run(started,now+3600000);
sql.prepare("INSERT INTO starts(challenge,user,started) VALUES('h','u',?)").run(started);sql.prepare("INSERT INTO captures(token,user,challenge,issued,expires) VALUES('token','u','h',?,?)").run(started+1,now+86400000);
const jpeg=new Uint8Array(readFileSync('tests/fixtures/metadata.jpg')),other=jpeg.slice();const scanMarker=jpeg.findIndex((v,i)=>v===255&&jpeg[i+1]===218),scanStart=scanMarker+2+(jpeg[scanMarker+2]*256+jpeg[scanMarker+3]);other[scanStart]^=1;assert.notDeepEqual(stripImageMetadata(jpeg.buffer,'image/jpeg'),stripImageMetadata(other.buffer,'image/jpeg'),'race candidates really contain different image bytes');
function request(taken,bytes){const form=new FormData();form.set('challenge','h');form.set('token','token');form.set('taken',String(taken));form.set('bonus_opt_in',taken===started+34567?'true':'false');form.set('photo',new Blob([bytes],{type:'image/jpeg'}),'capture.jpg');return new Request('https://test.invalid/api/hunt',{method:'POST',body:form})}
const replies=await Promise.all([uploadPhoto(request(started+23583,jpeg),{id:'u'}),uploadPhoto(request(started+34567,other),{id:'u'})]);
const results=await Promise.all(replies.map(r=>r.json()));assert.equal(results[0].elapsed,results[1].elapsed);assert.equal(sql.prepare('SELECT COUNT(*) n FROM submissions').get().n,1);assert.equal(objects.size,1,'losing candidate is removed without deleting or overwriting the winning image');
const winner=sql.prepare("SELECT * FROM submissions WHERE id='token'").get();assert.equal(!!sql.prepare("SELECT value FROM settings WHERE key='bonus-opt:token'").get(),winner.elapsed===34567,'only the winning picture can record its voluntary bonus consent');assert.equal(winner.elapsed,results[0].elapsed);assert(objects.has(winner.key));
// Metadata is stripped by the real implementation, so compare the preserved
// image entropy byte rather than the original EXIF-bearing whole file.
const stored=objects.get(winner.key),expected=stripImageMetadata((winner.elapsed===23583?jpeg:other).buffer,'image/jpeg');assert.deepEqual(stored,expected,'image and elapsed time belong to the same winner');
const retry=await uploadPhoto(request(started+45000,other),{id:'u'});assert.equal((await retry.json()).elapsed,winner.elapsed);assert.equal(puts,2,'confirmed retries never upload another object');
console.log('PASS: forced simultaneous upload, matching winning photo/time, one result/object, loser cleanup and immutable retry.');
sql.close();delete globalThis.fixture;
