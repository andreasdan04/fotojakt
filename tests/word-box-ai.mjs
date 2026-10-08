import {seedStaffAcceptance} from './helpers/staff.mjs';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const require=createRequire(import.meta.url),wr=createRequire(require.resolve('wrangler/package.json')),{Miniflare}=wr('miniflare'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
let unavailable=false,aiCalls=0,dictionaryCalls=0;
const mf=new Miniflare({modules:(await readdir('dist/server',{recursive:true})).filter(p=>p.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:0).map(p=>({type:'ESModule',path:path.resolve('dist/server',p)})),modulesRoot:path.resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{OPENAI_API_KEY:'synthetic-key'},cf:false,outboundService:async req=>{
 const url=new URL(req.url);assert.equal(req.headers.get('cookie'),null);
 if(url.hostname==='api.openai.com'){aiCalls++;const body=await req.json();assert.equal(body.store,false);assert.deepEqual(JSON.parse(body.messages[1].content),{word:'testmotiv'});assert(!JSON.stringify(body).includes('private@example.invalid'));if(unavailable)return new Response('',{status:503});return Response.json({choices:[{message:{content:JSON.stringify({norwegian:true,familyFriendly:true,safe:true,concreteLocal:true,reason:'Et trygt konkret motiv.'})}}]})}
 assert.equal(url.hostname,'ord.uib.no');assert.equal(req.headers.get('authorization'),null);dictionaryCalls++;
 if(url.pathname==='/api/articles'){assert.equal(url.searchParams.get('w'),'testmotiv');return Response.json({articles:{bm:[123]}})}
 assert.equal(url.pathname,'/bm/article/123.json');return Response.json({body:{definitions:[{type_:'definition',elements:[{type_:'explanation',content:'En syntetisk definisjon.',items:[]},{type_:'explanation',content:'Se $',items:[]},{type_:'example',quote:{content:'Et eksempel.'}}]}]}})
}});
try{
 const db=await mf.getD1Database('DB'),now=Date.now();for(const file of(await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())for(const sql of(await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
 for(const [id,isAdmin,signed] of [['staff',1,true],['unsigned',1,false],['player',0,false]]){await db.prepare("INSERT INTO members(id,name,email,status,joined,approved,admin) VALUES(?,?,?,'approved',1,1,?)").bind(id,'Private Name','private@example.invalid',isAdmin).run();await db.prepare('INSERT INTO login_sessions(token,user,expires) VALUES(?,?,?)').bind(hash(id),id,now+86400000).run();if(isAdmin)await db.prepare('INSERT INTO sessions(token,user,expires) VALUES(?,?,?)').bind(hash('admin-'+id),id,now+86400000).run();if(signed)await db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').bind('admin-agreement:'+id,JSON.stringify({version:'2026-10-07.1',accepted:now})).run();if(signed)await seedStaffAcceptance(db,id,now)}
 await db.prepare("INSERT INTO settings(key,value) VALUES('owner','staff')").run();
 await db.prepare("INSERT INTO word_suggestions(id,user,word,created) VALUES('w','player','testmotiv',1)").run();
 const req=(who,url,body)=>mf.dispatchFetch('https://test.invalid'+url,{method:body?'POST':'GET',headers:{...(who?{cookie:'hunt_login='+who+'; hunt_admin=admin-'+who}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const dict='/api/word-dictionary?id=w';assert.equal((await req(null,dict)).status,401);for(const who of ['player','unsigned'])assert.equal((await req(who,dict)).status,403);assert.equal(dictionaryCalls,0);
 const definition=await req('staff',dict);assert.equal(definition.status,200);assert.deepEqual((await definition.json()).definitions,['En syntetisk definisjon.']);await req('staff',dict);assert.equal(dictionaryCalls,2,'cached dictionary result avoids repeated transfer');
 let response=await req('staff','/api/hunt',{action:'review-word',id:'w',status:'assess'});assert.equal(response.status,200);assert.equal((await response.json()).status,'approved');assert.equal(aiCalls,1,'word AI works without content-AI flag');
 await db.prepare("UPDATE word_suggestions SET status='pending',ai_status='pending',ai_reviewed=NULL WHERE id='w'").run();unavailable=true;response=await req('staff','/api/hunt',{action:'assess-words'});assert.equal(response.status,200);const result=await response.json();assert.equal(result.pending,1);assert.equal(result.reviewed,0,'unavailable AI must not claim successful assessment');
 await req('staff','/api/hunt',{action:'review-word',id:'w',status:'approved'});await req('staff','/api/hunt',{action:'review-word',id:'w',status:'assess'});assert.equal((await db.prepare("SELECT status FROM word_suggestions WHERE id='w'").first()).status,'admin-approved');
 console.log('PASS: word-only AI payload, no profile data, independent word AI, truthful outage status, preserved manual approval, dictionary access control, exact definitions and cached word-only lookups.');
}finally{await mf.dispose()}
