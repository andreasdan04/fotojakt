import {anchorClock,clockNow,type HuntClock} from './hunt-clock';
export type SavedPhoto={id:string;user:string;challenge:string;title:string;token:string;photo:Blob;taken:number;elapsed:number;ready:boolean;revision?:number;windowId?:string;error?:string;blocked?:boolean;bonusOptIn?:boolean};
export type CameraLease={id:string;token:string;now:number;started:number;end:number;localNow:number;clock?:HuntClock;revision?:number;windowId?:string};
const DB_NAME='foto-jakt-outbox';
async function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{request.result.createObjectStore('photos',{keyPath:'id'});request.result.createObjectStore('leases',{keyPath:'id'})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Kunne ikke lagre på enheten. Kontroller at nettleseren har ledig lagringsplass.'))})}
async function transaction<T>(store:string,mode:IDBTransactionMode,operation:(s:IDBObjectStore)=>IDBRequest):Promise<T>{const db=await database();try{return await new Promise<T>((resolve,reject)=>{const tx=db.transaction(store,mode),request=operation(tx.objectStore(store));let result:T;request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(Error('Lokal lagring mislyktes. Bildet er ikke sikret på enheten.'))})}finally{db.close()}}
export const photoId=(user:string,challenge:string)=>user+':'+challenge;
export const savePhoto=(photo:SavedPhoto)=>transaction('photos','readwrite',s=>s.put(photo));
export const getPhoto=(id:string)=>transaction<SavedPhoto|undefined>('photos','readonly',s=>s.get(id));
export const deletePhoto=(id:string)=>transaction('photos','readwrite',s=>s.delete(id));
export const listPhotos=async(user:string,serverNow?:number)=>{const rows=await transaction<SavedPhoto[]>('photos','readonly',s=>s.getAll());for(const p of rows)if(serverNow!==undefined&&serverNow-p.taken>7*86400000){await deletePhoto(p.id);await deleteLease(p.id)}return rows.filter(p=>p.user===user&&(serverNow===undefined||serverNow-p.taken<=7*86400000))};
export const saveLease=(lease:CameraLease)=>transaction('leases','readwrite',s=>s.put(lease));
export const deleteLease=(id:string)=>transaction('leases','readwrite',s=>s.delete(id));
export const getLease=(id:string)=>transaction<CameraLease|undefined>('leases','readonly',s=>s.get(id));
export async function prepareCamera(user:string,challenge:string,force=false,expectedStart?:number,revision=0,expectedEnd?:number,windowId?:string){
 const id=photoId(user,challenge),cached=await getLease(id);
 function reusable(){
  if(force||!cached||cached.windowId!==windowId||(expectedStart!==undefined&&cached.started!==expectedStart)||(cached.revision||0)!==revision||(expectedEnd!==undefined&&cached.end!==expectedEnd))return false;
  try{const time=cached.clock?clockNow(cached.clock):cached.now+Date.now()-cached.localNow;return time>=cached.now&&time<cached.end}catch{return false}
 }
 if(!navigator.onLine&&reusable())return cached!;
 let response:Response;
 try{response=await fetch('/api/hunt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'camera',id:challenge}),signal:AbortSignal.timeout(15000)})}
 catch(error){
  // Browsers can still report online during an outage. A lease anchored in this
  // page is safe to resume without using the device's mutable wall clock.
  if(cached?.clock?.timeOrigin===performance.timeOrigin&&reusable())return cached;
  throw error;
 }
 const result:Partial<CameraLease>&{error?:string}=await response.json();if(!response.ok)throw Error(result.error||'Kunne ikke klargjøre kameraet.');
 if(typeof result.token!=='string'||!Number.isSafeInteger(result.now)||!Number.isSafeInteger(result.started)||!Number.isSafeInteger(result.end))throw Error('Kameraøkten mangler gyldige tider. Prøv igjen.');
 const lease:CameraLease={id,token:result.token,now:result.now!,started:result.started!,end:result.end!,revision:result.revision,windowId:result.windowId,localNow:Date.now(),clock:anchorClock(result.now!)};await saveLease(lease);return lease;
}
export function notifyOutbox(){window.dispatchEvent(new Event('photo-outbox'))}
export const connectionMessage='Tilkoblingen er ustabil. Bildet og tiden er lagret på denne enheten. Leveringen fortsetter automatisk når forbindelsen er tilbake. Hold appen åpen, eller åpne den igjen når du har nett.';
const uploading=new Map<string,Promise<boolean>>();
export function deliverPhoto(photo:SavedPhoto):Promise<boolean>{const existing=uploading.get(photo.id);if(existing)return existing;const task=upload(photo).finally(()=>uploading.delete(photo.id));uploading.set(photo.id,task);return task}
async function upload(photo:SavedPhoto){
 if(!photo.ready||photo.blocked||!navigator.onLine)return false;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
 try{
  // Do not upload a different user's private local queue after an account switch.
  const auth=await fetch('/api/hunt',{signal:controller.signal,cache:'no-store'});if(!auth.ok)return false;const user:{user?:{id?:string};challenges?:{id:string;revision?:number}[]}=await auth.json();if(user.user?.id!==photo.user)return false;
  const currentHunt=user.challenges?.find(c=>c.id===photo.challenge);if(currentHunt&&(currentHunt.revision||0)!==(photo.revision||0)){await deletePhoto(photo.id);await deleteLease(photo.id);window.dispatchEvent(new Event('hunt-word-changed'));return false;}
  const form=new FormData();form.set('challenge',photo.challenge);form.set('token',photo.token);form.set('taken',String(photo.taken));form.set('bonus_opt_in',photo.bonusOptIn===true?'true':'false');form.set('photo',photo.photo,'capture.jpg');
  const response=await fetch('/api/hunt',{method:'POST',body:form,signal:controller.signal});
  const result:{ok?:boolean;elapsed?:number;error?:string}=await response.json();
  if(!response.ok){if(response.status===401)return false;const blocked=response.status>=400&&response.status<500&&response.status!==429;const current=await getPhoto(photo.id);if(current?.token===photo.token)await savePhoto({...current,blocked,error:blocked?(result.error||'Bildet kunne ikke leveres.'):connectionMessage});return false}
  if(result.ok!==true||!Number.isSafeInteger(result.elapsed)||result.elapsed!<0)throw Error('Leveringen er ikke bekreftet.');
  const current=await getPhoto(photo.id);if(current?.token===photo.token)await deletePhoto(photo.id);return true;
 }catch{const current=await getPhoto(photo.id);if(current?.token===photo.token)await savePhoto({...current,error:connectionMessage});return false}
 finally{clearTimeout(timeout);notifyOutbox()}
}

export async function clearAttempt(user:string,challenge:string){
 const id=photoId(user,challenge),db=await database();
 try{await new Promise<void>((resolve,reject)=>{
  const tx=db.transaction(['photos','leases'],'readwrite');
  tx.objectStore('photos').delete(id);tx.objectStore('leases').delete(id);
  tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(Error('Kunne ikke rydde det lokale bildet.'));
 })}finally{db.close()}
 notifyOutbox();
}
