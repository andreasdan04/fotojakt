'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {toast} from 'sonner';
export default function PullRefresh({refresh,disabled=false}:{refresh:()=>Promise<any>,disabled?:boolean}){
 const [distance,setDistance]=useState(0),[loading,setLoading]=useState(false);
 const latest=useRef({refresh,disabled});latest.current={refresh,disabled};
 useEffect(()=>{
  let start:{x:number,y:number}|null=null,pull=0,running=false,alive=true;
  const blocked=()=>latest.current.disabled||!!document.querySelector('[role="dialog"],[role="alertdialog"],[data-slot="select-content"]');
  const reset=()=>{start=null;pull=0;if(alive)setDistance(0)};
  const begin=(e:TouchEvent)=>{
   reset();if(running||blocked()||window.scrollY>1||e.touches.length!==1)return;
   const target=e.target as HTMLElement;
   if(target.closest('input,textarea,select,button,a,[contenteditable="true"]'))return;
   // Nested scrolling regions keep their own normal touch behavior.
   for(let node:HTMLElement|null=target;node&&node!==document.body;node=node.parentElement){if(node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(getComputedStyle(node).overflowY))return}
   start={x:e.touches[0].clientX,y:e.touches[0].clientY};
  };
  const move=(e:TouchEvent)=>{
   if(!start)return;if(e.touches.length!==1||blocked()||window.scrollY>1){reset();return}
   const dy=e.touches[0].clientY-start.y,dx=e.touches[0].clientX-start.x;
   if(dy<0||Math.abs(dx)>Math.max(12,dy)){reset();return}
   if(dy<8)return;
   if(e.cancelable)e.preventDefault();
   pull=Math.min(112,dy*.5);setDistance(pull);
  };
  const end=async()=>{
   const activate=start&&pull>=72&&!blocked();reset();if(!activate||running)return;
   running=true;setLoading(true);
   try{
    const tasks:Promise<any>[]=[latest.current.refresh()];
    window.dispatchEvent(new CustomEvent('foto-jakt-refresh',{detail:{tasks}}));
    const results=await Promise.all(tasks);if(results[0]===null)throw Error('Kunne ikke oppdatere. Prøv igjen.');
    if(alive)toast.success('Oppdatert');
   }catch(e:any){if(alive)toast.error(e.message||'Kunne ikke oppdatere. Prøv igjen.')}
   finally{running=false;if(alive)setLoading(false)}
  };
  document.addEventListener('touchstart',begin,{passive:true});document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',end);document.addEventListener('touchcancel',reset);
  return()=>{alive=false;document.removeEventListener('touchstart',begin);document.removeEventListener('touchmove',move);document.removeEventListener('touchend',end);document.removeEventListener('touchcancel',reset)};
 },[]);
 if(!distance&&!loading)return null;
 return <div className="pull-refresh" role="status" aria-live="polite"><RefreshCw size={20} className={loading?'pull-refresh-spin':''} style={loading?undefined:{transform:`rotate(${distance*3}deg)`}}/><span>{loading?'Oppdaterer …':distance>=72?'Slipp for å oppdatere':'Dra ned for å oppdatere'}</span></div>;
}
