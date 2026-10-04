import {one,run,bucket,fail,json} from './server';
export const OFFLINE_GRACE=86400000;
export async function uploadPhoto(req:Request,m:any){
 if(Number(req.headers.get('content-length')||0)>6500000)fail('Bildet er for stort.');
 const form=await req.formData(),received=Date.now(),challenge=String(form.get('challenge')),token=String(form.get('token'));
 const cap=await one('SELECT * FROM captures WHERE token=? AND user=? AND challenge=?',token,m.id,challenge);if(!cap)fail('Kameraøkten finnes ikke. Bildet er fortsatt lagret på enheten.');
 const existing=await one('SELECT id,elapsed FROM submissions WHERE challenge=? AND user=?',challenge,m.id);
 if(existing){const start=await one('SELECT started FROM starts WHERE challenge=? AND user=?',challenge,m.id);if(existing.id===token||(!cap.issued&&(cap.used||cap.taken-start?.started===existing.elapsed)))return json({ok:true,elapsed:existing.elapsed});fail('Du har allerede levert et annet bilde til denne jakten.',409)}
 if(cap.used||cap.expires<=received)fail('Fristen for å gjenoppta leveringen er utløpt. Bildet er fortsatt lagret på enheten.');
 const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND s.end IS NULL',challenge);
 if(c&&cap.revision!==c.revision)fail('Jaktordet er byttet på grunn av vanskelighetsgraden. Start jakten på nytt.',409);
 if(!c||!c.start||c.start>received||received>=c.end+OFFLINE_GRACE||(!c.daily&&m.approved>c.start))fail('Denne jakten er ikke åpen for levering.');
 const attempt=c.daily?await one('SELECT started FROM starts WHERE challenge=? AND user=?',challenge,m.id):null;
 const local=form.get('taken'),clientTaken=local===null?null:Number(local);
 // New camera leases are issued online and bound to this user and hunt. Offline
 // capture times are client-reported (not cryptographic proof) and bounded by
 // lease issuance, server start, deadline and receipt. Old clients keep working.
 if(clientTaken!==null&&(!cap.issued||!Number.isSafeInteger(clientTaken)||clientTaken<cap.issued||clientTaken>received+2000||clientTaken>=c.end))fail('Bildets tidspunkt er utenfor den gyldige kameraøkten.');
 const finished=clientTaken??(c.daily?cap.taken:received),start=attempt?.started||c.start;
 if(!finished||(c.daily&&!attempt)||finished<start||finished>=c.end||(clientTaken===null&&received>=c.end))fail('Bildet må være tatt før jaktens frist.');
 const elapsed=finished-start,file=form.get('photo');
 if(!(file instanceof File)||file.type!=='image/jpeg'||file.size>6*1024*1024||file.size<100)fail('Bildet må være et kamerabilde under 6 MB.');
 const bytes=await file.arrayBuffer(),sig=new Uint8Array(bytes);if(sig[0]!==255||sig[1]!==216||sig[2]!==255)fail('Ugyldig bilde.');
 // The lease token is also the submission ID: a lost response can be retried
 // safely without creating another image or changing the registered time.
 const key='photos/'+token+'.jpg';await bucket().put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
 const inserted=await run('INSERT OR IGNORE INTO submissions(id,challenge,user,key,submitted,elapsed,valid,note) SELECT ?,?,?,?,?,?,1,? WHERE EXISTS(SELECT 1 FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND c.revision=? AND s.end IS NULL) AND EXISTS(SELECT 1 FROM captures WHERE token=? AND used=0)',token,challenge,m.id,key,received,elapsed,'',challenge,cap.revision,token);
 if(!inserted.meta.changes){const saved=await one('SELECT id,elapsed FROM submissions WHERE challenge=? AND user=?',challenge,m.id);if(saved?.id===token)return json({ok:true,elapsed:saved.elapsed});await bucket().delete(key);fail('Oppgaven er avsluttet eller et annet bilde er levert.',409)}
 await run('UPDATE captures SET used=1,taken=? WHERE token=?',finished,token);return json({ok:true,elapsed});
}
