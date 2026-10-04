'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bell,UserPlus,Users,MessageCircle,Heart} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';

type Notice={id:string,kind:string,title:string,detail:string,unread:boolean,hunt?:string,season?:string};
export default function NotificationInbox({userId,onSocial,onHunt,onWordChange}:{userId:string,onSocial:()=>void,onHunt:(hunt:string,season:string)=>void,onWordChange:()=>void}){
 const [open,setOpen]=useState(false),[data,setData]=useState<{items:Notice[],unread:number}|null>(null),[error,setError]=useState('');
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  try{const response=await fetch('/api/notifications',{cache:'no-store',signal});const value:any=await response.json();if(!response.ok)throw Error(value.error||'Kunne ikke hente varsler.');setData(value);setError('')}
  catch(e:any){if(e.name!=='AbortError')setError(e.message)}
 },[userId]);
 useEffect(()=>{const controller=new AbortController();setData(null);refresh(controller.signal);const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh(controller.signal)},15000);const wake=()=>{if(document.visibilityState==='visible')refresh(controller.signal)};document.addEventListener('visibilitychange',wake);return()=>{controller.abort();clearInterval(timer);document.removeEventListener('visibilitychange',wake)}},[refresh]);
 async function markRead(selectedIds?:string[]){
  if(!data)return;
  const ids=selectedIds||data.items.map(item=>item.id);
  try{const r=await fetch('/api/notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});if(!r.ok)throw Error('Kunne ikke markere varsler som lest.');setData(current=>current?{items:current.items.map(item=>ids.includes(item.id)?{...item,unread:false}:item),unread:current.items.filter(item=>item.unread&&!ids.includes(item.id)).length}:current);setError('')}catch(e:any){setError(e.message)}
 }
 function choose(item:Notice){void markRead([item.id]);setOpen(false);if((item.kind==='word-change'||item.kind==='difficulty-poll'))onWordChange();else if(item.hunt&&item.season)onHunt(item.hunt,item.season);else onSocial()}
 return <><button className="button header-inbox" aria-label={`Varsler${data?.unread?', '+data.unread+' uleste':''}`} onClick={()=>{setOpen(true);refresh()}}><Bell size={20}/>{!!data?.unread&&<span className="inbox-count">{data.unread>99?'99+':data.unread}</span>}</button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="notification-inbox !max-w-lg max-h-[85dvh] overflow-y-auto"><DialogTitle>Varsler</DialogTitle><DialogDescription>Endrede jaktord, venneforespørsler, gruppeinvitasjoner, aktivitet på bildene dine og svar på kommentarene dine. Vises her uansett valg for pushvarsler.</DialogDescription>{error&&<p className="error" role="alert">{error}<button className="button" onClick={()=>refresh()}>Prøv igjen</button></p>}{!data&&!error&&<p>Laster varsler …</p>}{data&&<>{data.unread>0&&<button className="button" onClick={()=>markRead()}>Marker alle som lest</button>}{!data.items.length&&<p className="muted">Ingen varsler ennå. Nye invitasjoner og aktiviteter vises her.</p>}<div className="inbox-list">{data.items.map(item=>{const Icon=item.kind==='friend'?UserPlus:item.kind==='group'?Users:(item.kind==='comment'||item.kind==='reply')?MessageCircle:(item.kind==='word-change'||item.kind==='difficulty-poll')?Bell:Heart;return <button key={item.id} className={'inbox-item'+(item.unread?' unread':'')} onClick={()=>choose(item)}><Icon size={20}/><span><strong>{item.title}</strong><small>{item.detail}</small></span>{item.unread&&<span className="inbox-unread" aria-label="Ulest"/>}</button>})}</div></>}</DialogContent></Dialog></>;
}
