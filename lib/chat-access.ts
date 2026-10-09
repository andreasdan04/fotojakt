import {one,fail} from './server';
import {roleFor} from './staff';
import {STAFF_CHAT_ROOM,staffChatMember} from './staff-chat';
export async function requireChatRoom(room:string,user:string){
 if(room===STAFF_CHAT_ROOM){if(!await staffChatMember(user))fail('Teamchatten krever en aktiv teamrolle og signert taushetserklæring.',403);return {name:'Dommerteam',canModerate:['owner','administrator'].includes(await roleFor(user))};}
 if(room==='public')return{name:'Felles chat',canModerate:false};
 if(room.startsWith('dm:')){const f=await one("SELECT m.name FROM friendships f JOIN members m ON m.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE 'dm:'||f.a||':'||f.b=? AND (f.a=? OR f.b=?) AND f.status='accepted' AND m.status='approved'",user,room,user,user);if(!f)fail('Denne vennechatten er ikke tilgjengelig.',403);return{name:f.name,canModerate:false};}
 const g=await one('SELECT g.name,g.owner,gm.role FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=? AND gm.user=?',room,user);if(!g)fail('Du har ikke tilgang til denne gruppechatten.',403);return{name:g.name,canModerate:g.owner===user||g.role==='admin'};
}
