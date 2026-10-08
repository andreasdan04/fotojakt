import {one,db,fail} from './server';
import {ADMIN_AGREEMENT_VERSION,ADMIN_AGREEMENT_TEXT} from './admin-agreement';
import {type StaffRole} from './staff-labels';
export {type StaffRole,ROLE_NAMES} from './staff-labels';
export async function roleFor(user:string):Promise<StaffRole>{
 const m=await one('SELECT admin,status FROM members WHERE id=?',user);if(m?.status!=='approved')return 'player';
 if((await one("SELECT value FROM settings WHERE key='owner'"))?.value===user)return 'owner';
 const role=(await one('SELECT role FROM staff_roles WHERE user=?',user))?.role;
 return ['administrator','head_judge','judge'].includes(role)?role:m.admin?'administrator':'player';
}
export async function currentAgreement(){
 const row=await one("SELECT value FROM settings WHERE key='staff-agreement-current'");
 if(row){try{const v=JSON.parse(row.value);if(typeof v.version!=='string'||typeof v.text!=='string'||typeof v.requiredAt!=='number')throw Error();return v}catch{fail('Taushetserklæringen kunne ikke leses.',503)}}
 return {version:ADMIN_AGREEMENT_VERSION,text:ADMIN_AGREEMENT_TEXT,requiredAt:0};
}
export async function acceptanceFor(user:string){
 const agreement=await currentAgreement();
 return one('SELECT id,version,name,created FROM staff_acceptances WHERE user=? AND revoked IS NULL AND created>=? ORDER BY created DESC,id DESC LIMIT 1',user,agreement.requiredAt);
}
// Rechecked inside mutation transactions, including the exact privileged session.
export function staffGuard(user:string,token:string,roles:StaffRole[]=['owner','administrator','head_judge','judge']){
 const role="CASE WHEN m.id=(SELECT value FROM settings WHERE key='owner') THEN 'owner' ELSE COALESCE((SELECT role FROM staff_roles WHERE user=m.id),CASE WHEN m.admin=1 THEN 'administrator' ELSE 'player' END) END";
 return {sql:`EXISTS(SELECT 1 FROM members m JOIN sessions ss ON ss.user=m.id WHERE m.id=? AND m.status='approved' AND ss.token=? AND ss.expires>? AND ${role} IN (${roles.map(()=>'?').join(',')}) AND EXISTS(SELECT 1 FROM staff_acceptances a WHERE a.user=m.id AND a.revoked IS NULL AND a.created>=COALESCE((SELECT json_extract(value,'$.requiredAt') FROM settings WHERE key='staff-agreement-current'),0)))`,args:[user,token,Date.now(),...roles]};
}
export async function pruneStaffRecords(now=Date.now()){
 await db().prepare('DELETE FROM staff_acceptances WHERE revoked IS NOT NULL AND revoked<?').bind(now-90*86400000).run();
}
