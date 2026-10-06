// Reading permission is passive. Only the explicit settings action may request it.
export async function readPushDevice(surface:any=globalThis){
 const permission=surface.Notification?.permission||'unsupported';
 const supported=!!surface.Notification&&!!surface.PushManager&&!!surface.navigator?.serviceWorker;
 if(!supported)return {permission,registered:false,supported,subscription:null};
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([(async()=>{
  const registration=await surface.navigator.serviceWorker.getRegistration();
  const subscription=await registration?.pushManager?.getSubscription();
  return {permission,registered:permission==='granted'&&!!subscription,supported,subscription};
 })(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Varslingsstatus tok for lang tid.')),8000)})])}
 finally{clearTimeout(timer)}
}
