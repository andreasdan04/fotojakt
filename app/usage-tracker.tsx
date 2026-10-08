'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {trackUsage} from '@/lib/usage-client';
const subscribe=(listener:()=>void)=>{window.addEventListener('analytics-changed',listener);return()=>window.removeEventListener('analytics-changed',listener)};
const snapshot=()=>typeof window!=='undefined'&&(window as any).__fotoAnalytics===true;
export default function UsageTracker({user,tab,camera,results,settings}:{user:string;tab:string;camera:boolean;results:boolean;settings:boolean}){
 const enabled=useSyncExternalStore(subscribe,snapshot,()=>false);
 useEffect(()=>{if(!enabled)return;trackUsage('visit');let hiddenAt=0;const visible=()=>{if(document.visibilityState==='hidden')hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>=1800000){trackUsage('visit');hiddenAt=0}};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible)},[user,enabled]);
 useEffect(()=>{if(enabled)trackUsage(tab)},[user,tab,enabled]);
 useEffect(()=>{if(enabled&&camera)trackUsage('camera')},[camera,enabled]);
 useEffect(()=>{if(enabled&&results)trackUsage('results')},[results,enabled]);
 useEffect(()=>{if(enabled&&settings)trackUsage('settings')},[settings,enabled]);
 return null;
}
