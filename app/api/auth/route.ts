import {username} from '@/lib/groups';
import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {currentUser,digest,loginName,pinHash,validatePin,limit,session,owner} from '@/lib/auth';
import {admin,one,all,run,db,origin,wrap,json,fail,str} from '@/lib/server';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{origin(req);const b:any=await req.json();const now=Date.now();
if(b.action==='logout'){const u=await currentUser();const jar=await cookies();if(u&&typeof b.endpoint==='string')await run('DELETE FROM push_subscriptions WHERE user=? AND endpoint=?',u.userId,b.endpoint);const token=jar.get('hunt_login')?.value;if(token)await run('DELETE FROM login_sessions WHERE token=?',await digest(token));const a=jar.get('hunt_admin')?.value;if(a)await run('DELETE FROM sessions WHERE token=?',a);const h=new Headers({'Cache-Control':'no-store','Content-Type':'application/json'});for(const c of ['hunt_login','hunt_admin'])h.append('Set-Cookie',`${c}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);return new Response('{"ok":true}',{headers:h})}
if(b.action==='pin'){await limit(req,'admin',12);if(!(env as any).ADMIN_PIN||b.pin!==String((env as any).ADMIN_PIN))fail('Feil PIN.',403);return session(await owner(),true)}
if(b.action==='set-pin'){await admin(req);const m=await one('SELECT * FROM members WHERE id=? AND admin=0',b.id);if(!m)fail('Fant ikke medlemmet.');const existing=await one('SELECT login FROM local_accounts WHERE user=?',m.id);const login=existing?.login||loginName(b.name||m.name);const collision=await one('SELECT user FROM local_accounts WHERE login=? AND user<>?',login,m.id);if(collision)fail('Navnet er i bruk. Velg et annet innloggingsnavn.');const salt=crypto.randomUUID(),hash=await pinHash(validatePin(b.pin),salt);await db().batch([db().prepare('INSERT INTO local_accounts(user,login,salt,hash) VALUES (?,?,?,?) ON CONFLICT(user) DO UPDATE SET salt=excluded.salt,hash=excluded.hash').bind(m.id,login,salt,hash),db().prepare('DELETE FROM login_sessions WHERE user=?').bind(m.id),db().prepare('DELETE FROM push_subscriptions WHERE user=?').bind(m.id)]);return json({ok:true,login})}
if(!['register','login'].includes(b.action))fail('Ukjent handling.');const login=b.action==='register'?username(b.username):loginName(b.name);await limit(req,'name:'+login);await limit(req,'ip:'+(req.headers.get('cf-connecting-ip')||'shared'),60);if(b.action==='login'&&typeof b.pin==='string'&&/^\d{4}$/.test(b.pin)){
 await limit(req,'admin',12);
 const configured=(env as any).ADMIN_PIN;
 const selected=(await one("SELECT value FROM settings WHERE key='owner'"))?.value||(await one('SELECT id FROM members WHERE admin=1 ORDER BY joined LIMIT 1'))?.id||'administrator';
 const administrator=await one('SELECT m.name,m.username,a.login FROM members m LEFT JOIN local_accounts a ON a.user=m.id WHERE m.id=? AND m.admin=1',selected);
 const names=administrator?[administrator.name,administrator.username,administrator.login]:['Andreas'];
 if(!configured||!/^\d{4}$/.test(String(configured))||b.pin!==String(configured)||!names.some(value=>typeof value==='string'&&value.normalize('NFKC').toLocaleLowerCase('nb-NO')===login))fail('Feil navn eller PIN. Glemt PIN? Be Andreas om en ny.',403);
 return session(await owner(),true);
}
const pin=validatePin(b.pin);
if(b.action==='register'){if(b.installed!==true)fail('Legg appen på hjemskjermen og åpne den derfra før du registrerer deg.');const reserved=await one('SELECT id FROM members WHERE username=?',login);if(reserved||await one('SELECT user FROM local_accounts WHERE login=?',login))fail('Navnet er allerede i bruk. Logg inn, eller be Andreas om hjelp.');const id=crypto.randomUUID(),salt=crypto.randomUUID(),hash=await pinHash(pin,salt);try{await db().batch([db().prepare('INSERT INTO members(id,name,username,email,status,joined,approved,admin) VALUES (?,?,?,?,?,?,?,0)').bind(id,str(b.name,40),login,'','approved',now,now),db().prepare('INSERT INTO local_accounts(user,login,salt,hash) VALUES (?,?,?,?)').bind(id,login,salt,hash)])}catch{fail('Navnet er allerede i bruk. Prøv å logge inn.')}return session(id)}
const account=await one('SELECT a.* FROM local_accounts a JOIN members m ON m.id=a.user WHERE a.login=? OR m.username=?',login,login);const hash=await pinHash(pin,account?.salt||'missing-account');let diff=0;const expected=account?.hash||'0'.repeat(64);for(let i=0;i<64;i++)diff|=hash.charCodeAt(i)^expected.charCodeAt(i);if(!account||diff)fail('Feil navn eller PIN. Glemt PIN? Be Andreas om en ny.',403);return session(account.user);
});
