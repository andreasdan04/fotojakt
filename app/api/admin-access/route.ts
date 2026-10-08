import {ADMIN_AGREEMENT_VERSION} from '@/lib/admin-agreement';
import {admin,adminSession,siteOwner,one,all,db,origin,wrap,json,fail,str} from '@/lib/server';
import {currentAgreement,acceptanceFor,staffGuard,pruneStaffRecords,type StaffRole} from '@/lib/staff';
import {validSignature} from '@/lib/signature';
import {auditPrivacyRead} from '@/lib/privacy';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{
 const u=await adminSession(req),document=await currentAgreement(),agreement=await acceptanceFor(u.userId),isOwner=u.role==='owner',target=new URL(req.url).searchParams.get('agreement');
 if(target){if(target!==u.userId)await siteOwner(req);const id=str(target,100);await auditPrivacyRead(u.userId,'staff-agreement-read',[id]);const records=await all('SELECT * FROM staff_acceptances WHERE user=? ORDER BY created DESC,id DESC',id);const legacy=(await one('SELECT value FROM settings WHERE key=?','admin-agreement:'+id))?.value;return json({records:records.map((r:{signature:string;document:string})=>({...r,signature:JSON.parse(r.signature),text:r.document})),legacy:legacy?JSON.parse(legacy):null});}
 let members;
 if(agreement&&['owner','administrator'].includes(u.role)){
  members=await all(`SELECT m.id,m.name,m.username,m.status,
   CASE WHEN m.id=(SELECT value FROM settings WHERE key='owner') THEN 'owner' ELSE COALESCE(r.role,CASE WHEN m.admin=1 THEN 'administrator' ELSE 'player' END) END role,
   (SELECT json_object('version',a.version,'created',a.created) FROM staff_acceptances a WHERE a.user=m.id AND a.revoked IS NULL AND a.created>=? ORDER BY a.created DESC,a.id DESC LIMIT 1) agreement
   FROM members m LEFT JOIN staff_roles r ON r.user=m.id ORDER BY m.name,m.id`,document.requiredAt);
  members=members.map((m:{agreement:string|null;role:StaffRole;status:string})=>({...m,agreement:m.agreement?JSON.parse(m.agreement):null,activeAccess:m.status==='approved'&&m.role!=='player'&&!!m.agreement}));
 }
 return json({...document,accepted:!!agreement,agreement,isOwner,role:u.role,members});
});
export const POST=wrap(async(req:Request)=>{
 origin(req);const u=await adminSession(req),b=await req.json() as {action?:string;accepted?:boolean;version?:string;name?:string;signature?:unknown;id?:string;role?:StaffRole;enabled?:boolean;text?:string;material?:boolean;expectedVersion?:string},now=Date.now(),document=await currentAgreement(),d=db();
 if(b.action==='accept'){
  if(b.accepted!==true||b.version!==document.version)fail('Les og godkjenn gjeldende taushetserklæring.');
  const name=str(b.name,100);if(name.split(/\s+/).length<2)fail('Oppgi fullt navn.');if(!validSignature(b.signature))fail('Tegn din faktiske underskrift i signaturfeltet. En tom signatur eller et enkelt trykk kan ikke godtas.');
  const result=await d.prepare(`INSERT OR IGNORE INTO staff_acceptances(id,user,name,role,version,document,signature,created) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM sessions ss JOIN members m ON m.id=ss.user WHERE ss.user=? AND ss.token=? AND ss.expires>? AND m.status='approved' AND (m.admin=1 OR EXISTS(SELECT 1 FROM staff_roles WHERE user=m.id))) AND COALESCE((SELECT json_extract(value,'$.version') FROM settings WHERE key='staff-agreement-current'),?)=?`).bind(crypto.randomUUID(),u.userId,name,u.role,document.version,document.text,JSON.stringify(b.signature.map(stroke=>stroke.map(({x,y})=>({x,y})))),now,u.userId,u.sessionToken,now,ADMIN_AGREEMENT_VERSION,b.version).run();
  if(!result.meta.changes&&!await acceptanceFor(u.userId))fail('Rollen eller erklæringen er endret. Hent siden på nytt.',409);return json({ok:true});
 }
 if(b.action==='role'){
  const actor=await admin(req),id=str(b.id,100),role=b.role??(b.enabled===true?'administrator':b.enabled===false?'player':null);
  if(!role||!['administrator','head_judge','judge','player'].includes(role))fail('Velg en gyldig rolle.');
  const m=await one('SELECT status,admin,(SELECT role FROM staff_roles WHERE user=members.id) role FROM members WHERE id=?',id);if(!m)fail('Brukeren finnes ikke.',404);const previous=(await one("SELECT value FROM settings WHERE key='owner'"))?.value===id?'owner':m.role|| (m.admin?'administrator':'player');
  if(previous==='owner')fail('Eierrollen kan ikke endres.',403);
  if(actor.role!=='owner'&&(previous==='administrator'||role==='administrator'))fail('Bare eieren kan administrere administratorer.',403);
  if(role!=='player'&&(m.status!=='approved'||!await one('SELECT user FROM local_accounts WHERE user=?',id)))fail('Brukeren må være aktiv og ha personlig innlogging.');
  if(previous===role)return json({ok:true});
  const guard=staffGuard(actor.userId,actor.sessionToken,actor.role==='owner'?['owner']:['administrator']);
  // The authorization claim and all dependent writes share one D1 transaction.
  const claim='staff-change:'+crypto.randomUUID(),proof=`EXISTS(SELECT 1 FROM settings WHERE key='${claim}')`;
  const allowed=actor.role==='owner'?"1=1":"NOT EXISTS(SELECT 1 FROM members WHERE id=? AND admin=1) AND NOT EXISTS(SELECT 1 FROM staff_roles WHERE user=? AND role='administrator')";
  const q=[d.prepare(`INSERT INTO settings(key,value) SELECT ?,? WHERE ${guard.sql} AND ?<>COALESCE((SELECT value FROM settings WHERE key='owner'),'') AND ${allowed}`).bind(claim,JSON.stringify({actor:actor.userId,target:id,action:'set-role',role,created:now}),...guard.args,id,...(actor.role==='owner'?[]:[id,id])),d.prepare(`UPDATE members SET admin=? WHERE id=? AND ${proof}`).bind(role==='administrator'?1:0,id)];
  q.push(role==='player'?d.prepare(`DELETE FROM staff_roles WHERE user=? AND ${proof}`).bind(id):d.prepare(`INSERT INTO staff_roles(user,role,updated,actor) SELECT ?,?,?,? WHERE ${proof} ON CONFLICT(user) DO UPDATE SET role=excluded.role,updated=excluded.updated,actor=excluded.actor`).bind(id,role,now,actor.userId));
  q.push(d.prepare(`UPDATE staff_acceptances SET revoked=? WHERE user=? AND revoked IS NULL AND ${proof}`).bind(now,id),d.prepare(`UPDATE settings SET value=json_set(value,'$.revoked',?) WHERE key=? AND ${proof}`).bind(now,'admin-agreement:'+id));
  for(const table of ['sessions','login_sessions'])q.push(d.prepare(`DELETE FROM ${table} WHERE user=? AND ${proof}`).bind(id));
  const result=await d.batch(q);if(!result[0].meta.changes)fail('Tilgangen ble endret. Hent teamet på nytt.',409);await pruneStaffRecords();return json({ok:true});
 }
 if(b.action==='document'){
  const actor=await siteOwner(req),text=str(b.text,20000);if(text.length<300)fail('Erklæringen må inneholde en fullstendig tekst.');if(typeof b.material!=='boolean'||b.expectedVersion!==document.version)fail('Erklæringen er endret. Hent gjeldende versjon.',409);
  const version=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(now)+'.'+crypto.randomUUID(),next={version,text,requiredAt:b.material?Math.max(now,Number((await one('SELECT MAX(created) latest FROM staff_acceptances'))?.latest||0)+1):document.requiredAt};
  const guard=staffGuard(actor.userId,actor.sessionToken,['owner']);
  const res=await d.prepare(`INSERT INTO settings(key,value) SELECT 'staff-agreement-current',? WHERE ${guard.sql} AND COALESCE((SELECT json_extract(value,'$.version') FROM settings WHERE key='staff-agreement-current'),?)=? ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(JSON.stringify(next),...guard.args,ADMIN_AGREEMENT_VERSION,b.expectedVersion).run();
  if(!res.meta.changes)fail('Tilgangen eller erklæringen er endret.',409);return json({ok:true,requiresSignature:b.material});
 }
 fail('Ukjent handling.');
});
