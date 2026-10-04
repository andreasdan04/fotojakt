export function sortedPhotos(photos:any[],mode:string){
 const ranked=[...photos].sort((a,b)=>b.valid-a.valid||a.elapsed-b.elapsed||a.submitted-b.submitted||a.id.localeCompare(b.id));
 const result=ranked.map((photo,i)=>({...photo,place:photo.valid?i:null}));
 if(mode==='worst')return result.sort((a,b)=>b.valid-a.valid||(b.place??0)-(a.place??0));
 if(mode==='newest')return result.sort((a,b)=>b.submitted-a.submitted||a.id.localeCompare(b.id));
 if(mode==='oldest')return result.sort((a,b)=>a.submitted-b.submitted||a.id.localeCompare(b.id));
 return result;
}
