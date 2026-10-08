import {usageActions} from './usage-events';
export function trackUsage(event:string){if(typeof document==='undefined'||document.visibilityState!=='visible'||(window as any).__fotoAnalytics!==true)return;void fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event}),keepalive:true}).catch(()=>{});}
export function trackUsageAction(action:string){const event=usageActions[action];if(event)trackUsage(event)}

export function setAnalyticsConsent(enabled:boolean){if(typeof window==='undefined')return;(window as any).__fotoAnalytics=enabled;window.dispatchEvent(new CustomEvent('analytics-changed',{detail:enabled}));}
