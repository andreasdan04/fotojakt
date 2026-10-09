import {all,one} from './server';
export const STAFF_CHAT_ROOM='staff:judges';
export type StaffChatReader={id:string;name:string;joined:number;readCreated:number;readId:string};
// Trusted internal SQL alias only. Role and acceptance are checked again inside
// message/reaction writes, so a removed role cannot keep writing to the team.
export function staffChatEligible(alias='m'){
 const role=`CASE WHEN ${alias}.id=(SELECT value FROM settings WHERE key='owner') THEN 'owner' ELSE COALESCE((SELECT role FROM staff_roles WHERE user=${alias}.id),CASE WHEN ${alias}.admin=1 THEN 'administrator' ELSE 'player' END) END`;
 return `${alias}.status='approved' AND ${role} IN ('owner','administrator','head_judge','judge') AND EXISTS(SELECT 1 FROM staff_acceptances a WHERE a.user=${alias}.id AND a.revoked IS NULL AND a.created>=COALESCE((SELECT json_extract(value,'$.requiredAt') FROM settings WHERE key='staff-agreement-current'),0))`;
}
export function staffChatGuard(user:string){return {sql:`EXISTS(SELECT 1 FROM members m WHERE m.id=? AND ${staffChatEligible()})`,args:[user]};}
export async function staffChatMember(user:string){return one(`SELECT m.id,m.name FROM members m WHERE m.id=? AND ${staffChatEligible()}`,user);}
export async function staffChatReaders():Promise<StaffChatReader[]>{return all(`SELECT m.id,m.name,0 joined,COALESCE(json_extract(r.value,'$.created'),0) readCreated,COALESCE(json_extract(r.value,'$.id'),'') readId FROM members m LEFT JOIN settings r ON r.key='dm-read:'||m.id||':${STAFF_CHAT_ROOM}' WHERE ${staffChatEligible()}`);}
export async function staffChatSummary(user:string){
 if(!await staffChatMember(user))return null;
 const reader=await one('SELECT value FROM settings WHERE key=?','dm-read:'+user+':'+STAFF_CHAT_ROOM);
 const cursor=reader?JSON.parse(reader.value):{created:0,id:''};
 const notice=await one(`SELECT x.id,x.created,COUNT(*) OVER() unread FROM chat_messages x JOIN members m ON m.id=x.user WHERE x.room=? AND m.status='approved' AND x.user!=? AND (x.created>? OR (x.created=? AND x.id>?)) ORDER BY x.created DESC,x.id DESC LIMIT 1`,STAFF_CHAT_ROOM,user,cursor.created,cursor.created,cursor.id);
 return {id:STAFF_CHAT_ROOM,name:'Dommerteam',kind:'staff',unread:notice?.unread||0,latestId:notice?.id||null,latestCreated:notice?.created||0};
}
