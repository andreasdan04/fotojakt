import {admin,adminSession,siteOwner,one,all,db,origin,wrap,json,fail,str} from '@/lib/server';
import {ADMIN_AGREEMENT_VERSION,ADMIN_AGREEMENT_TEXT} from '@/lib/admin-agreement';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{
 const u=await adminSession(req),owner=(await one("SELECT value FROM settings WHERE key='owner'"))?.value;
 const value=(await one('SELECT value FROM settings WHERE key=?','admin-agreement:'+u.userId))?.value;
 const agreement=value?JSON.parse(value):null;
 const accepted=!!agreement&&agreement.version===ADMIN_AGREEMENT_VERSION&&!agreement.revoked;
 const target=new URL(req.url).searchParams.get('agreement');
 if(target){await siteOwner(req);const row=await one('SELECT value FROM settings WHERE key=?','admin-agreement:'+str(target,100));if(!row)fail('Erklæringen finnes ikke.',404);return json({agreement:JSON.parse(row.value)});}
 return json({version:ADMIN_AGREEMENT_VERSION,text:ADMIN_AGREEMENT_TEXT,accepted,agreement,isOwner:owner===u.userId,ownerId:owner,
  members:accepted&&owner===u.userId?await all("SELECT m.id,m.name,m.username,m.admin,m.status,CASE WHEN json_extract(s.value,'$.version')=? AND json_extract(s.value,'$.revoked') IS NULL THEN 1 ELSE 0 END agreementAccepted FROM members m LEFT JOIN settings s ON s.key='admin-agreement:'||m.id ORDER BY m.name",ADMIN_AGREEMENT_VERSION):undefined});
});
export const POST=wrap(async(req:Request)=>{
 origin(req);const u=await adminSession(req),b:any=await req.json(),now=Date.now();
 if(b.action==='accept'){
  if(b.accepted!==true||b.version!==ADMIN_AGREEMENT_VERSION)fail('Les og godkjenn gjeldende taushetserklæring.');
  const name=str(b.name,100),email=str(b.email,254),address=str(b.address,300),signature=str(b.signature,100);
  if(name.split(/\s+/).length<2||address.length<5||!/^\S+@\S+\.\S+$/.test(email))fail('Fyll inn fullt navn, gyldig e-post og postadresse.');
  if(signature.normalize('NFKC').toLocaleLowerCase('nb-NO')!==name.normalize('NFKC').toLocaleLowerCase('nb-NO'))fail('Elektronisk underskrift må være det fulle navnet du oppga.');
  const d=db();const result=await d.prepare("INSERT INTO settings(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM members WHERE id=? AND admin=1 AND status='approved') ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE json_extract(settings.value,'$.version')<>? OR json_extract(settings.value,'$.revoked') IS NOT NULL").bind('admin-agreement:'+u.userId,JSON.stringify({user:u.userId,name,email,address,signature,version:ADMIN_AGREEMENT_VERSION,text:ADMIN_AGREEMENT_TEXT,accepted:now}),u.userId,ADMIN_AGREEMENT_VERSION).run();
  if(!result.meta.changes){await admin(req);return json({ok:true,alreadyAccepted:true});}return json({ok:true});
 }
 if(b.action==='role'){
  await siteOwner(req);const id=str(b.id,100);if(typeof b.enabled!=='boolean')fail('Velg gi eller fjern tilgang.');
  if(id===(await one("SELECT value FROM settings WHERE key='owner'"))?.value)fail('Eierens tilgang kan ikke endres her.',403);
  const m=await one('SELECT id,status,admin FROM members WHERE id=?',id);if(!m||b.enabled&&m.status!=='approved')fail('Velg en aktiv bruker.');
  if(b.enabled&&!await one('SELECT user FROM local_accounts WHERE user=?',id))fail('Opprett en personlig innlogging for brukeren før du gir adminrolle.');
  if(!!m.admin===b.enabled)return json({ok:true});
  const d=db(),q=[d.prepare('UPDATE members SET admin=? WHERE id=?').bind(b.enabled?1:0,id),d.prepare('DELETE FROM sessions WHERE user=?').bind(id),d.prepare('DELETE FROM login_sessions WHERE user=?').bind(id)];
  // A re-grant requires fresh acceptance; a revoked record has a bounded retention window.
  q.push(b.enabled?d.prepare('DELETE FROM settings WHERE key=?').bind('admin-agreement:'+id):d.prepare("UPDATE settings SET value=json_set(value,'$.revoked',?) WHERE key=?").bind(now,'admin-agreement:'+id));
  q.push(d.prepare('INSERT INTO settings(key,value) VALUES (?,?)').bind('privacy-audit:'+crypto.randomUUID(),JSON.stringify({actor:u.userId,target:id,action:b.enabled?'grant-admin':'revoke-admin',created:now})));
  await d.batch(q);return json({ok:true});
 }
 fail('Ukjent handling.');
});
