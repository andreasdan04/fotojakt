import {identity,origin,one,wrap,json,fail} from '@/lib/server';
import {verifyPrivacyPin} from '@/lib/privacy';
import {deleteMember} from '@/lib/deletion';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{origin(req);const u=await identity(),b:any=await req.json();await verifyPrivacyPin(req,u.userId,b.pin);if(b.confirm!=='SLETT')fail('Skriv SLETT for å bekrefte.');if((await one('SELECT COUNT(*) n FROM groups WHERE owner=?',u.userId)).n>0)fail('Overfør eller slett gruppene du eier før kontoen slettes.',409);await deleteMember(u.userId,'self-service');const h=new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});for(const c of ['hunt_login','hunt_admin'])h.append('Set-Cookie',`${c}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);return new Response(JSON.stringify({ok:true,localCleanupRequired:true}),{headers:h});});
