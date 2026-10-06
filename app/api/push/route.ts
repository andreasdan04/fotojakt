import {socialPreferences,notificationsEnabled} from '@/lib/social-push';
import {env} from 'cloudflare:workers';
import {identity,origin,json,wrap,fail,one,run} from '@/lib/server';
import {validateSubscription,pushConfigured,sendPush,notificationStatus} from '@/lib/push';
export const dynamic='force-dynamic';
async function pushMember(){const u=await identity();const m=await one('SELECT * FROM members WHERE id=?',u.userId);if(!m||!['pending','approved'].includes(m.status))fail('Tilgangen er ikke godkjent.',403);return m}
export const GET=wrap(async()=>{const m=await pushMember();return json({notificationsEnabled:await notificationsEnabled(m.id),preferences:await socialPreferences(m.id),publicKey:(env as any).VAPID_PUBLIC_KEY||null,...await notificationStatus()})});
export const POST=wrap(async(req:Request)=>{origin(req);const m=await pushMember();const b:any=await req.json();
 if(b.action==='notifications'){
  if(typeof b.enabled!=='boolean')fail('Ugyldig varslingsvalg.');
  await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','push_disabled:'+m.id,b.enabled?'0':'1');
  if(!b.enabled){
   await run("UPDATE push_deliveries SET status='skipped' WHERE status='pending' AND subscription IN(SELECT id FROM push_subscriptions WHERE user=?)",m.id);
   await run("UPDATE social_push SET status='skipped' WHERE status='pending' AND subscription IN(SELECT id FROM push_subscriptions WHERE user=?)",m.id);
  }
  if(!b.enabled)await run("UPDATE invitation_push SET status='skipped' WHERE status='pending' AND recipient=?",m.id);
  return json({ok:true,notificationsEnabled:b.enabled});
 }
 if(b.action==='preferences'){if(!['comments','reactions','replies','friends','groups'].includes(b.kind)||typeof b.enabled!=='boolean')fail('Ugyldig varslingsvalg.');await run(`INSERT INTO notification_preferences(user,${b.kind}) VALUES (?,?) ON CONFLICT(user) DO UPDATE SET ${b.kind}=excluded.${b.kind}`,m.id,b.enabled?1:0);if(!b.enabled)await run("UPDATE social_push SET status='skipped' WHERE status='pending' AND kind=? AND subscription IN (SELECT id FROM push_subscriptions WHERE user=?)",b.kind==='replies'?'reply':b.kind==='comments'?'comment':'reaction',m.id);if(!b.enabled&&['friends','groups'].includes(b.kind))await run("UPDATE invitation_push SET status='skipped' WHERE status='pending' AND recipient=? AND kind=?",m.id,b.kind==='friends'?'friend':'group');return json({ok:true,preferences:await socialPreferences(m.id)})}
 if(b.action==='unsubscribe'){await run('DELETE FROM push_subscriptions WHERE user=? AND endpoint=?',m.id,String(b.endpoint||''));return json({ok:true})}
 if(!pushConfigured())fail('Varsling er ikke klar ennå. Prøv igjen om litt.',503);
 if(b.action==='subscribe'){
  if(b.installed!==true)fail('Åpne appen fra hjemskjermen for å aktivere varsler.');
  const s=validateSubscription(b.subscription),now=Date.now();
  const old=await one('SELECT * FROM push_subscriptions WHERE endpoint=?',s.endpoint);
  if(old&&old.user!==m.id)fail('Denne enheten er registrert på en annen konto. Slå av varsler i nettleseren og aktiver dem på nytt.');
  if(!old){const count=await one('SELECT COUNT(*) n FROM push_subscriptions WHERE user=?',m.id);if(count.n>=10)fail('Du har nådd grensen på ti enheter.');}
  const id=old?.id||crypto.randomUUID();await run('INSERT INTO push_subscriptions(id,user,endpoint,p256dh,auth,created,updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated=excluded.updated',id,m.id,s.endpoint,s.keys.p256dh,s.keys.auth,old?.created||now,now);
  return json({ok:true,id,...await notificationStatus()});
 }
 if(b.action==='test'){
  if(!await notificationsEnabled(m.id))fail('Varsler er slått av på kontoen din.');
  const sub=await one('SELECT * FROM push_subscriptions WHERE user=? AND endpoint=?',m.id,b.endpoint);if(!sub)fail('Aktiver varsler på denne enheten først.');
  const rateKey='push_test:'+sub.id;const rate=await one('SELECT value FROM settings WHERE key=?',rateKey);if(rate&&Date.now()-Number(rate.value)<30000)fail('Vent 30 sekunder før du tester igjen.',429);
  await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',rateKey,String(Date.now()));
  const status=await sendPush(sub,{title:'📸 Varsler er klare!',body:'Denne enheten kan motta Foto Jakt-varsler, også når appen er lukket.',tag:'photo-hunt-test',url:'/',kind:'test',expires:Date.now()+300000});
  if(status===404||status===410){await run('DELETE FROM push_subscriptions WHERE id=?',sub.id);fail('Varslingstillatelsen er utløpt. Aktiver varsler på nytt.');}
  if(status<200||status>=300)fail('Testvarselet kunne ikke sendes. Prøv igjen.',502);return json({ok:true});
 }
 fail('Ukjent handling.');
});
