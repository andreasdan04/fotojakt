import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {build}=createRequire(require.resolve('vite'))('esbuild');
const root=process.cwd(),dir=mkdtempSync(tmpdir()+'/foto-game-');
const serverStub=`const d=()=>globalThis.__env.DB;export const db=d;export const all=async(q,...a)=>(await d().prepare(q).bind(...a).all()).results;export const one=async(q,...a)=>d().prepare(q).bind(...a).first();export const run=async(q,...a)=>d().prepare(q).bind(...a).run();export const bucket=()=>globalThis.__bucket;export function fail(m,s=400){throw Object.assign(Error(m),{status:s})}export const str=(v)=>{if(typeof v!=='string'||!v.trim())fail('text');return v};`;
const dailyStub=readFileSync('lib/hunt-times.ts','utf8');
await build({entryPoints:['lib/game.ts','lib/game-rules.ts','lib/scoring.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',plugins:[{name:'isolated-d1',setup(b){b.onResolve({filter:/cloudflare:workers/},()=>({path:'cloudflare',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const env=globalThis.__env;'}));b.onLoad({filter:/\/lib\/server\.ts$/},()=>({contents:serverStub,loader:'ts'}));b.onLoad({filter:/\/lib\/daily\.ts$/},()=>({contents:dailyStub,loader:'ts'}))}}]});
const sql=new DatabaseSync(':memory:');
for(const e of JSON.parse(readFileSync('drizzle/meta/_journal.json')).entries)sql.exec(readFileSync('drizzle/'+e.tag+'.sql','utf8').replaceAll('--> statement-breakpoint',''));
const prepare=(q)=>({bind(...args){const s=sql.prepare(q);return {first:async()=>s.get(...args)||null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:{changes:Number(s.run(...args).changes)}})};}});
globalThis.__env={DB:{prepare,batch:async ss=>{sql.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}}};
globalThis.__bucket={get:async()=>({arrayBuffer:async()=>new Uint8Array([255,216,255,0]).buffer})};
const game=await import(dir+'/game.js'),rules=await import(dir+'/game-rules.js'),{rank}=await import(dir+'/scoring.js');
const now=Date.parse('2026-10-05T20:30:00Z');
sql.prepare('INSERT INTO members(id,name,email,status,joined,approved) VALUES (?,?,?,?,?,?)').run('u','Andreas','test@example.test','approved',now-100000,now-100000);
sql.prepare('INSERT INTO seasons(id,name,start,daily,first_day,last_day) VALUES (?,?,?,1,?,?)').run('s','Oktober',now-86400000,'2026-10-04','2026-11-10');
test('weekly schedule is stored once, fixed Oslo premiere and hidden push until 30 minutes',async()=>{
 await game.ensureGames(now);const before=sql.prepare('SELECT * FROM challenges').all();assert.equal(before.length,5);const first=before.find(x=>x.id==='lightning:2026-10-05');assert.equal(first.start,rules.FIRST_LIGHTNING);assert.equal(first.end-first.start,1200000);assert.equal(new Date(first.start).toISOString(),'2026-10-06T15:00:00.000Z');
 await game.ensureGames(now+1000);assert.deepEqual(sql.prepare('SELECT * FROM challenges').all(),before);
 assert.deepEqual(rules.lightningEvents(first,first.start-1800001),[]);assert.equal(rules.lightningEvents(first,first.start-1800000)[0].kind,'lightning-warning');assert.equal(rules.lightningEvents(first,first.start)[0].kind,'lightning-start');assert.deepEqual(rules.lightningEvents(first,first.end),[]);
});
test('bonus validation routes low confidence and failures to manual; never mutates normal submission',async()=>{
 assert.equal(rules.bonusVerdict({verdict:'approved',confidence:.99,reason:'Rødt'}),'approved');assert.equal(rules.bonusVerdict({verdict:'rejected',confidence:.4,reason:'Usikkert'}),'manual');assert.equal(rules.bonusVerdict({verdict:'uncertain',confidence:1,reason:'Usikkert'}),'manual');assert.equal(rules.bonusVerdict({verdict:'approved',confidence:3,reason:'x'}),'manual');
 sql.prepare('INSERT INTO challenges(id,season,title,start,end,duration,created,daily,day,slot) VALUES (?,?,?,?,?,?,?,1,?,1)').run('normal','s','Kopp',now-60000,now+60000,120000,now-100000,'2026-10-05');sql.prepare('INSERT INTO game_hunts(challenge,bonus) VALUES (?,?)').run('normal','Bildet inneholder også noe rødt');sql.prepare('INSERT INTO submissions(id,challenge,user,key,submitted,elapsed) VALUES (?,?,?,?,?,?)').run('photo','normal','u','photos/photo.jpg',now,9583);
 const before=sql.prepare('SELECT * FROM submissions WHERE id=?').get('photo');await game.processBonuses(now);assert.equal(sql.prepare('SELECT COUNT(*) n FROM bonus_reviews').get().n,0,'no opt-in means no review and no external AI');sql.prepare('INSERT INTO settings(key,value) VALUES (?,?)').run('bonus-opt:photo',JSON.stringify({user:'u',version:'2026-10-06.1'}));await game.processBonuses(now);assert.equal(sql.prepare('SELECT status FROM bonus_reviews').get().status,'manual','opted-in bonuses use manual grading');assert.deepEqual(sql.prepare('SELECT * FROM submissions WHERE id=?').get('photo'),before);
 await game.reviewBonus({id:'photo',status:'approved',reason:'Test review'},'u');await assert.rejects(()=>game.reviewBonus({id:'photo',status:'rejected',reason:'Already reviewed'},'u'));
});
test('bonus and lightning scoring is idempotent and optional hunt does not break streak',()=>{
 const hunts=[{id:'a',daily:1,start:100,end:200},{id:'lightning:x',start:210,end:300},{id:'b',daily:1,start:310,end:400}];const submissions=[{id:'1',challenge:'a',user:'u',valid:1,elapsed:20,submitted:120,bonus_points:2},{id:'2',challenge:'b',user:'u',valid:1,elapsed:30,submitted:330}];const members=[{id:'u',name:'u',approved:0}];const r=rank(hunts,submissions,members,500)[0];assert.equal(r.points,22);assert.equal(r.streak,2);assert.equal(r.missed,0);assert.deepEqual(rank(hunts,submissions,members,500)[0],r);
 submissions.push({id:'3',challenge:'lightning:x',user:'u',valid:1,elapsed:3,submitted:220});assert.equal(rank(hunts,submissions,members,500)[0].points,25);
});
test('secret requirements stay hidden, awards and acknowledgement persist, locked titles rejected',async()=>{
 const g=await game.gameFor('u',now);const blink=g.secrets.find(s=>s.id==='blink');assert.equal(blink.title,'BLINKSKUDD');const locked=g.secrets.find(s=>s.id==='storm');assert.equal(locked.title,'???');assert.equal(locked.description,'');assert.ok(g.notices.some(n=>n.id==='secret:blink'));
 await game.gameAction({action:'game-seen',id:'secret:blink'},'u');const repeat=await game.gameFor('u',now);assert.ok(!repeat.notices.some(n=>n.id==='secret:blink'));await assert.rejects(()=>game.gameAction({action:'active-title',id:'veteran'},'u'));await game.gameAction({action:'active-title',id:''},'u');
});
