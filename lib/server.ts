export {rank} from './scoring';
import {env} from 'cloudflare:workers';
import {currentUser} from './auth';
export const db=()=>{const d=(env as any).DB;if(!d)throw Error('Databasen er midlertidig utilgjengelig. Prøv igjen.');return d};
export const bucket=()=>{const b=(env as any).BUCKET;if(!b)throw Error('Bildelagringen er midlertidig utilgjengelig.');return b};
export const one=async(sql:string,...args:any[])=>db().prepare(sql).bind(...args).first();
export const all=async(sql:string,...args:any[])=>(await db().prepare(sql).bind(...args).all()).results;
export const run=async(sql:string,...args:any[])=>db().prepare(sql).bind(...args).run();
export function fail(message:string,status=400):never{throw Object.assign(Error(message),{status})}
export async function identity(){const u=await currentUser();if(!u)fail('Logg inn først.',401);return u!}
export async function member(){const u=await identity();const m=await one('SELECT * FROM members WHERE id=?',u.userId);if(!m||m.status!=='approved')fail('Du må godkjennes av Andreas først.',403);return m}
export async function admin(req:Request){const u=await identity();const token=req.headers.get('cookie')?.match(/(?:^|; )hunt_admin=([^;]+)/)?.[1];const s=token&&await one('SELECT s.user FROM sessions s JOIN members m ON m.id=s.user WHERE s.token=? AND s.expires>? AND m.admin=1 AND m.status=?',token,Date.now(),'approved');if(!s||s.user!==u.userId)fail('Logg inn på administratorsiden med PIN.',403);return u}
export function origin(req:Request){const o=req.headers.get('origin');if(o&&o!==new URL(req.url).origin)fail('Ugyldig forespørsel.',403)}
export const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const wrap=(fn:any)=>async(req:Request,ctx:any)=>{try{return await fn(req,ctx)}catch(e:any){console.error('Foto Jakt',e.message);return json({error:e.status?e.message:'Noe gikk galt. Prøv igjen om litt.'},e.status||500)}};
export const str=(v:any,n=150)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)fail('Fyll inn gyldig tekst.');return v.trim()};
