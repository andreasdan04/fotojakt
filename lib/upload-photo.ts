// Retry the same captured photo and token; never take another photo on upload failure.
export async function uploadPhoto(form:FormData){
 for(let attempt=0;attempt<3;attempt++){
  let response:Response;
  try{response=await fetch('/api/hunt',{method:'POST',body:form})}
  catch{if(attempt<2){await pause(attempt);continue}throw Error('Opplastingen ble avbrutt. Bildet og tiden er beholdt. Trykk «Prøv å sende igjen».')}
  const data:any=await response.json().catch(()=>null);
  if(response.ok&&data?.ok)return data;
  if((response.status>=500||response.status===408||response.status===429||response.ok)&&attempt<2){await pause(attempt);continue}
  throw Error(data?.error||'Kunne ikke laste opp bildet. Bildet og tiden er beholdt. Trykk «Prøv å sende igjen».');
 }
}
const pause=(attempt:number)=>new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
