import {ensureGames,processBonuses} from './game';
import {processChatReviews} from './chat-moderation';
import {dispatchInvitations} from './invitation-push';
import {ensureWordDescriptions} from './word-descriptions';
import {settleDifficultyPolls} from './difficulty-polls';
import {dispatchWordChanges} from './replace-word';
import {applyApprovedWords} from './approved-words';
import {upgradeFutureDaily} from './daily';
import {settleReports} from './photo-reports';
import {dispatchChat} from './chat-notifications';
import {dispatchSocial,notificationsEnabled} from './social-push';
import {cleanDeletedPhotos} from './deletion';
import {env} from 'cloudflare:workers';
import webpush from 'web-push';
import {all,one,run,fail} from './server';
import {eventsForChallenge,seasonStartEvent} from './push-events';
export function pushConfigured(){return !!((env as any).VAPID_PUBLIC_KEY&&(env as any).VAPID_PRIVATE_KEY)}
export function validateSubscription(s:any){
 if(!s||typeof s.endpoint!=='string'||s.endpoint.length>2048)fail('Ugyldig varslingsabonnement.');
 let u:URL;try{u=new URL(s.endpoint)}catch{fail('Ugyldig varslingsadresse.')}
 // Only standard browser push providers. Never send outbound requests to arbitrary URLs.
 const host=u!.hostname;const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host.endsWith('.push.services.mozilla.com')||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com');
 if(u!.protocol!=='https:'||u!.port||u!.username||u!.password||!allowed)fail('Denne nettleserens varslingstjeneste støttes ikke ennå.');
 if(!/^[A-Za-z0-9_-]{87}$/.test(s.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(s.keys?.auth||''))fail('Ugyldige varslingsnøkler.');
 return s;
}
// Native app devices. The Expo push token is stored as the endpoint; p256dh/auth are empty.
export function validateExpoToken(token:any){
 if(typeof token!=='string'||!/^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(token))fail('Ugyldig varslingstoken.');
 return token as string;
}
// Android only shows notifications on channels the app has created: 'hunts' and 'social'.
const SOCIAL_KINDS=['chat','invitation','social'];
async function sendExpoPush(sub:any,payload:any,ttl:number){
 const headers:Record<string,string>={'Content-Type':'application/json',Accept:'application/json'};
 if((env as any).EXPO_ACCESS_TOKEN)headers.Authorization=`Bearer ${(env as any).EXPO_ACCESS_TOKEN}`;
 const message={to:validateExpoToken(sub.endpoint),title:payload.title,body:payload.body,data:{url:payload.url,kind:payload.kind,expires:payload.expires},ttl:Math.max(0,Math.floor(ttl)),priority:'high',sound:'default',collapseId:payload.tag,tag:payload.tag,channelId:SOCIAL_KINDS.includes(payload.kind)?'social':'hunts'};
 const res=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers,body:JSON.stringify(message),redirect:'manual',signal:AbortSignal.timeout(8000)});
 if(!res.ok){await res.body?.cancel();return res.status}
 // Map the push ticket onto the Web Push statuses every dispatcher already handles: 410 removes the device.
 const ticket=((await res.json().catch(()=>null)) as any)?.data;
 if(ticket?.status==='ok')return 201;
 return ticket?.details?.error==='DeviceNotRegistered'?410:ticket?.details?.error==='MessageRateExceeded'?429:502;
}
export async function sendPush(sub:any,payload:any,ttl=300){
 if(sub.provider==='expo')return sendExpoPush(sub,payload,ttl);
 if(!pushConfigured())throw Error('Push is not configured');
 validateSubscription({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}});
 const req=webpush.generateRequestDetails({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{vapidDetails:{subject:'https://photo-hunt-family.andreasdan04.chatgpt.site',publicKey:(env as any).VAPID_PUBLIC_KEY,privateKey:(env as any).VAPID_PRIVATE_KEY},TTL:Math.max(0,Math.floor(ttl)),urgency:'high',contentEncoding:'aes128gcm'});
 const headers=new Headers(req.headers);headers.delete('content-length');
 const res=await fetch(req.endpoint,{method:'POST',headers,body:req.body,redirect:'manual',signal:AbortSignal.timeout(8000)});
 await res.body?.cancel();return res.status;
}
export async function notificationStatus(){const seen=await one('SELECT value FROM settings WHERE key=?','push_scheduler_seen');return {configured:pushConfigured(),schedulerOnline:!!seen&&Date.now()-Number(seen.value)<120000,lastCheck:seen?Number(seen.value):null}}
export async function dispatchPush(){
 const now=Date.now(),lease=String(now+90000);
 const lock=await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(value AS INTEGER)<?','push_scheduler_lock',lease,now);
 if(!lock.meta.changes)return {busy:true,sent:0};
 try{
  await ensureGames(now);await processBonuses(now);await settleDifficultyPolls(now);await upgradeFutureDaily(now);await applyApprovedWords(now);await ensureWordDescriptions(now);await cleanDeletedPhotos();await settleReports();
  if(!pushConfigured())throw Error('Push keys are missing');
  await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','push_scheduler_seen',String(now));
  const challenges=await all('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE s.end IS NULL AND c.start IS NOT NULL AND c.end>?',now);
  const subs=await all("SELECT p.*,m.approved FROM push_subscriptions p JOIN members m ON m.id=p.user WHERE m.status=? AND NOT EXISTS(SELECT 1 FROM settings off WHERE off.key='push_disabled:'||p.user AND off.value='1')",'approved');
  const completed=new Set((await all('SELECT s.challenge,s.user FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE c.end>?',now)).map((s:any)=>s.challenge+':'+s.user));
  const seasons=await all('SELECT * FROM seasons ORDER BY start DESC');
  const announcements=new Map<string,any>();
  for(const season of seasons.filter((s:any)=>!s.end)){
   const first=challenges.filter((c:any)=>c.season===season.id&&c.start<=now).sort((a:any,b:any)=>a.start-b.start)[0];
   if(!first)continue;
   const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(now);
   const hasPrevious=seasons.some((s:any)=>s.start<season.start&&(s.end&&s.end<=now||s.last_day&&s.last_day<today));
   const event=seasonStartEvent(first,season,hasPrevious,now);
   if(event)announcements.set(first.id,event);
  }
  let jobs:any[]=[];
  for(const c of challenges){const announcement=announcements.get(c.id);const events=eventsForChallenge(c,now).filter(e=>!announcement||e.kind!=='start');if(announcement)events.push(announcement);for(const event of events){for(const sub of subs){
   // No backlog on a newly registered device, and no challenges before membership.
   if(sub.created>event.due||sub.approved>(c.daily?event.due:event.start)||completed.has(c.id+':'+sub.user))continue;
   const id=`${sub.id}:${event.key}`;const previous=await one('SELECT status,attempts,next_attempt FROM push_deliveries WHERE id=?',id);
   if(previous&&(previous.status!=='pending'||previous.attempts>=5||previous.next_attempt>now))continue;
   jobs.push({sub,event,id});
  }}}
  // Prefer current start messages. If the scheduler resumes late, avoid sending
  // both the announcement and the reminder together for the same challenge.
  jobs.sort((a,b)=>b.event.due-a.event.due);const selected:any[]=[],keys=new Set();
  for(const j of jobs){const key=j.sub.id+':'+j.event.challenge;if(keys.has(key)){await run("INSERT OR IGNORE INTO push_deliveries(id,subscription,challenge,kind,status,attempts,next_attempt,created) VALUES (?,?,?,?,?,0,0,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status WHERE push_deliveries.status='pending'",j.id,j.sub.id,j.event.challenge,j.event.kind,'skipped',now);continue;}keys.add(key);selected.push(j)}
  let sent=0,failed=0;
  for(let i=0;i<Math.min(selected.length,20);i+=4){await Promise.all(selected.slice(i,Math.min(i+4,20)).map(async({sub,event,id})=>{
   await run('INSERT OR IGNORE INTO push_deliveries(id,subscription,challenge,kind,status,attempts,next_attempt,created) VALUES (?,?,?,?,?,0,0,?)',id,sub.id,event.challenge,event.kind,'pending',now);
   try{
    const current=await one('SELECT c.id FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND s.end IS NULL AND c.start IS NOT NULL AND c.end>?',event.challenge,Date.now());if(!current){await run('DELETE FROM push_deliveries WHERE id=?',id);return;}
    // Recheck immediately before sending, including retries and every device.
    const eligible=await one('SELECT p.id FROM push_subscriptions p JOIN members m ON m.id=p.user WHERE p.id=? AND m.status=? AND (?=1 OR NOT EXISTS (SELECT 1 FROM submissions s WHERE s.challenge=? AND s.user=p.user))',sub.id,'approved',0,event.challenge);
    if(!eligible||!await notificationsEnabled(sub.user)||event.expires<=Date.now()){await run('UPDATE push_deliveries SET status=? WHERE id=?','skipped',id);return;}
    const status=await sendPush(sub,{title:event.title,body:event.body,tag:event.key,url:event.kind.startsWith('lightning-')?'/?lightning=1':event.kind==='season-start'?'/':'/?hunt='+encodeURIComponent(event.challenge),kind:event.kind,expires:event.expires},Math.ceil((event.expires-Date.now())/1000));
    if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);await run('UPDATE push_deliveries SET status=?,last_status=? WHERE id=?','expired',status,id);return;}
    if(status>=200&&status<300){await run('UPDATE push_deliveries SET status=?,sent=?,last_status=?,attempts=attempts+1 WHERE id=?','sent',Date.now(),status,id);sent++;}
    else{await run('UPDATE push_deliveries SET attempts=attempts+1,last_status=?,next_attempt=? WHERE id=?',status,Date.now()+60000,id);failed++;}
   }catch(error:any){console.error('Push delivery failed:',String(error.message).replace(/https?:\/\/\S+/g,'[endpoint]'));await run('UPDATE push_deliveries SET attempts=attempts+1,next_attempt=? WHERE id=?',Date.now()+60000,id);failed++;}
  }))}
  await run('DELETE FROM push_deliveries WHERE created<? AND challenge IN (SELECT id FROM challenges WHERE end<?)',now-30*86400000,now);
  const invitations=await dispatchInvitations(sendPush),chat=await dispatchChat(sendPush),social=await dispatchSocial(sendPush),changes=await dispatchWordChanges(sendPush);await processChatReviews(now);return {sent:sent+social.sent+changes.sent+chat.sent+invitations.sent,failed:failed+social.failed+changes.failed+chat.failed+invitations.failed,remaining:Math.max(0,selected.length-20),nextCheckMs:15000};
 }finally{await run('UPDATE settings SET value=? WHERE key=? AND value=?','0','push_scheduler_lock',lease)}
}
