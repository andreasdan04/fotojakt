'use client';
import {useState} from 'react';
import {Share2,Copy} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {toast} from 'sonner';

export default function ShareHunt({username,compact=false}:{username?:string,compact?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const url='https://familienglum.no/';
 const text=`Bli med på Foto Jakt! 📸 To fotooppgaver hver dag – finn motivet, ta bilde og konkurrer med venner. ${username?`Legg meg til: @${username}`:"Inviter vennene dine og bli med!"}`;
 const message=`${text}\n\n${url}`;
 async function copy(){try{await navigator.clipboard.writeText(message);toast.success('Lenke og brukernavn er kopiert!');setOpen(false)}catch{setOpen(true)}}
 async function share(){
  setBusy(true);
  try{
   if(navigator.share)await navigator.share({text:message});
   else await copy();
  }catch(e:any){if(e.name!=='AbortError')setOpen(true)}finally{setBusy(false)}
 }
 return <>{compact?<button type="button" className="button header-share" aria-label="Del Foto Jakt" disabled={busy} onClick={share}><Share2 size={18}/><span>Del</span></button>:<div className="share-hunt"><div><strong>Ta med venner på fotojakt</strong><p>Del lenken med brukernavnet ditt: <b>@{username}</b></p></div><button type="button" className="button" disabled={busy||!username} onClick={share}><Share2 size={18}/>Del Foto Jakt</button></div>}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Del Foto Jakt</DialogTitle><DialogDescription>Kopier invitasjonen og send den til vennene dine.</DialogDescription><textarea aria-label="Invitasjon med lenke og brukernavn" readOnly value={message} rows={6} onFocus={e=>e.currentTarget.select()}/><button className="button" onClick={copy}><Copy size={18}/>Kopier invitasjon</button></DialogContent></Dialog></>;
}
