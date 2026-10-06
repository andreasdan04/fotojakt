'use client';
import {useEffect,useRef} from 'react';
import {trackUsage} from '@/lib/usage-client';
export default function UsageTracker({user,tab,camera,results,settings}:{user:string;tab:string;camera:boolean;results:boolean;settings:boolean}){
 const interaction=useRef(Date.now());
 useEffect(()=>{const touch=()=>{interaction.current=Date.now()};const pulse=()=>{if(document.visibilityState==='visible'&&Date.now()-interaction.current<120000)trackUsage('presence')};const visible=()=>{if(document.visibilityState==='visible'){touch();pulse()}};pulse();const timer=setInterval(pulse,30000);document.addEventListener('pointerdown',touch,{passive:true});document.addEventListener('keydown',touch);document.addEventListener('visibilitychange',visible);return()=>{clearInterval(timer);document.removeEventListener('pointerdown',touch);document.removeEventListener('keydown',touch);document.removeEventListener('visibilitychange',visible)}},[user]);
 useEffect(()=>{trackUsage(tab)},[user,tab]);
 useEffect(()=>{if(camera)trackUsage('camera')},[camera]);
 useEffect(()=>{if(results)trackUsage('results')},[results]);
 useEffect(()=>{if(settings)trackUsage('settings')},[settings]);
 return null;
}
