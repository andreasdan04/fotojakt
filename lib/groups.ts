import {one,fail} from './server';
// Internal SQL fragments only. Escape the authenticated ID as a SQLite literal.
const literal=(v:string)=>"'"+v.replace(/'/g,"''")+"'";
export function groupAudienceSql(viewer:string,column='s.user'){
 const id=literal(viewer);
 return `(${column}=${id} OR (${column} IN (SELECT id FROM members WHERE status='approved') AND EXISTS(SELECT 1 FROM group_members me JOIN group_members peer ON peer.group_id=me.group_id WHERE me.user=${id} AND peer.user=${column})))`;
}
// Arguments are internal SQL expressions, never request input. Friendship is
// direct and accepted; neither friends-of-friends nor pending requests qualify.
export function peerAudienceSql(viewer:string,column:string){
 return `(EXISTS(SELECT 1 FROM group_members me JOIN group_members peer ON peer.group_id=me.group_id WHERE me.user=${viewer} AND peer.user=${column}) OR EXISTS(SELECT 1 FROM friendships f WHERE f.status='accepted' AND ((f.a=${viewer} AND f.b=${column}) OR (f.b=${viewer} AND f.a=${column}))))`;
}
export function audienceSql(viewer:string,column='s.user'){
 const id=literal(viewer);
 return `(${column}=${id} OR (${column} IN (SELECT id FROM members WHERE status='approved') AND ${peerAudienceSql(id,column)}))`;
}
export async function requirePhotoAudience(id:string,viewer:string){
 if(!await one(`SELECT s.id FROM submissions s WHERE s.id=? AND ${audienceSql(viewer)}`,id))fail('Bildet finnes ikke eller er ikke delt med deg.',403);
}
export function username(value:any){if(typeof value!=='string')fail('Velg et brukernavn.');const name=value.trim().toLowerCase();if(!/^[a-z0-9_\.]{3,30}$/.test(name))fail('Brukernavn må ha 3–30 tegn: a–z, tall, punktum eller understrek.');return name;}

export async function friendCount(user:string){
 const row=await one("SELECT COUNT(*) n FROM friendships f JOIN members m ON m.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND f.status='accepted' AND m.status='approved'",user,user,user);
 return Number(row?.n||0);
}
