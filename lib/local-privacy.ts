export async function clearLocalData(){
 if(typeof window==='undefined')return;
 await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('foto-jakt-outbox');r.onsuccess=()=>resolve();r.onerror=()=>reject(Error('Kunne ikke fjerne lokale bilder.'));r.onblocked=()=>reject(Error('Lukk andre Foto Jakt-faner og prøv igjen.'));});
 localStorage.clear();sessionStorage.clear();
 if('caches' in window)for(const key of await caches.keys())await caches.delete(key);
}
