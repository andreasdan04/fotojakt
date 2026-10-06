import {usageActions} from './usage-events';
export function trackUsage(event:string){if(typeof document==='undefined'||document.visibilityState!=='visible')return;void fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event}),keepalive:true}).catch(()=>{});}
export function trackUsageAction(action:string){const event=usageActions[action];if(event)trackUsage(event)}
