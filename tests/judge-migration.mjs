import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const d=new DatabaseSync(':memory:');const files=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
function apply(text){for(const sql of text.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))d.exec(sql);}
for(const f of files.filter(f=>f<'0033'))apply(await readFile('drizzle/'+f,'utf8'));
d.exec("INSERT INTO members(id,name,email,status,joined,admin) VALUES('player','Synthetic','private@test.invalid','approved',1,0),('reviewer','Reviewer','','approved',1,1);INSERT INTO settings(key,value) VALUES('owner','reviewer');INSERT INTO seasons(id,name,start) VALUES('s','Old Album',1);INSERT INTO challenges(id,season,title,start,end,duration,created) VALUES('h','s','Old Word',1,2,1,1);INSERT INTO submissions(id,challenge,user,key,submitted,elapsed,valid,note) VALUES('old','h','player','private.jpg',1,957,0,'Original rejection');INSERT INTO bonus_reviews(submission,status,reason,updated) VALUES('old','rejected','Original bonus rejection',2);");
d.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('privacy-audit:photo',JSON.stringify({actor:'reviewer',action:'hunt-submission-review',ids:['old'],created:2}));
d.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('privacy-audit:bonus',JSON.stringify({actor:'reviewer',action:'bonus-review',ids:['old'],created:2}));
d.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('admin-agreement:reviewer',JSON.stringify({version:'2026-10-07.1',name:'Old Typed Name',signature:'Old Typed Name',accepted:1}));
const before=d.prepare("SELECT * FROM submissions WHERE id='old'").get();for(const f of files.filter(f=>f>='0033'))apply(await readFile('drizzle/'+f,'utf8'));
assert.deepEqual(d.prepare("SELECT * FROM submissions WHERE id='old'").get(),before,'history and elapsed time preserved');
const decisions=d.prepare('SELECT * FROM review_decisions ORDER BY kind').all();assert.equal(decisions.length,2);assert(decisions.every(x=>x.actor==='reviewer'&&x.current===1&&x.status==='rejected'));assert.equal(decisions[0].reason,'Original bonus rejection');assert.equal(decisions[1].reason,'Original rejection');
assert.equal(d.prepare('SELECT COUNT(*) n FROM staff_acceptances').get().n,0,'typed acceptance cannot masquerade as handwritten signature');assert(d.prepare("SELECT value FROM settings WHERE key='admin-agreement:reviewer'").get(),'old declaration retained');assert.equal(d.prepare("SELECT admin FROM members WHERE id='reviewer'").get().admin,1,'existing administrator role preserved');
console.log('PASS: upgrade from the existing schema preserves submissions, elapsed time, rejections and previous declaration; imports bonus/photo decisions with known original reviewer; requires new handwritten signature.');d.close();
