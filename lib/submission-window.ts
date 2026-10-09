import {all,one,db,fail,str} from './server';
import {staffGuard} from './staff';
import type {Reviewer} from './judging';
export type SubmissionWindow={id:string;user:string;challenge:string;created:number;expires:number;actor:string;previous:string|null;revision:number};
export const windowKey=(challenge:string,user:string)=>'submission-window:'+challenge+':'+user;
export async function submissionWindow(challenge:string,user:string,now=Date.now()):Promise<SubmissionWindow|null>{
 const row=await one('SELECT value FROM settings WHERE key=?',windowKey(challenge,user));
 if(!row)return null;const w=JSON.parse(row.value) as SubmissionWindow;
 return w.user===user&&w.challenge===challenge&&w.created<=now&&w.expires>now?w:null;
}
export async function ownSubmissionWindows(user:string,now=Date.now()):Promise<SubmissionWindow[]>{
 return (await all("SELECT value FROM settings WHERE key LIKE 'submission-window:%' AND json_extract(value,'$.user')=? AND json_extract(value,'$.expires')>?",user,now)).map((r:{value:string})=>JSON.parse(r.value));
}
export async function openSubmissionWindow(challengeValue:unknown,userValue:unknown,actor:Reviewer){
 if(actor.role!=='owner')fail('Bare eier kan åpne ekstra levering.',403);
 const challenge=str(challengeValue,100),user=str(userValue,100),now=Date.now();
 const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND s.end IS NULL',challenge);
 if(!c?.start||c.start>now)fail('Velg en jakt som har startet i et åpent album.');
 if(!await one("SELECT id FROM members WHERE id=? AND status='approved'",user))fail('Velg en aktiv deltaker.');
 const previous=await one('SELECT id FROM submissions WHERE challenge=? AND user=?',challenge,user);
 const w:SubmissionWindow={id:crypto.randomUUID(),user,challenge,created:now,expires:now+600000,actor:actor.userId,previous:previous?.id||null,revision:c.revision};
 const guard=staffGuard(actor.userId,actor.sessionToken,['owner']),key=windowKey(challenge,user);
 const d=db(),result=await d.batch([d.prepare(`INSERT INTO settings(key,value) SELECT ?,? WHERE ${guard.sql} AND EXISTS(SELECT 1 FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND c.revision=? AND s.end IS NULL) AND EXISTS(SELECT 1 FROM members WHERE id=? AND status='approved') ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(key,JSON.stringify(w),...guard.args,challenge,c.revision,user),d.prepare("INSERT INTO settings(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND json_extract(value,'$.id')=?)").bind('privacy-audit:'+w.id,JSON.stringify({actor:actor.userId,action:'open-submission-window',ids:[user,challenge],created:now,expires:w.expires}),key,w.id)]);
 if(!result[0].meta.changes)fail('Tilgangen eller jakten er endret. Oppdater siden.',409);
 return {ok:true,expires:w.expires,user,challenge};
}
export async function windowForCapture(token:string,user:string,challenge:string,now=Date.now()){
 const lease=await one('SELECT value FROM settings WHERE key=?','submission-window-capture:'+token);
 if(!lease)return null;const w=await submissionWindow(challenge,user,now);
 if(!w||w.id!==lease.value)fail('De ti minuttene for ekstra levering er utløpt eller erstattet.',409);
 return w;
}
