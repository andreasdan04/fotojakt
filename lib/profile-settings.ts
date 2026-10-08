import {one,run} from './server';
export async function profileSettings(user:string){
 const row=await one('SELECT value FROM settings WHERE key=?','profile:'+user);
 let value:any={};try{value=JSON.parse(row?.value||'{}')}catch{}
 return {bio:typeof value.bio==='string'?value.bio.slice(0,160):'',featuredBadge:typeof value.featuredBadge==='string'?value.featuredBadge:'',showFriendCount:value.showFriendCount===true,theme:['light','dark','system'].includes(value.theme)?value.theme:'system'};
}
export async function saveProfileSettings(user:string,value:any){await run('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','profile:'+user,JSON.stringify(value));}
