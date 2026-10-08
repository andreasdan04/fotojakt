import {admin,member,origin,json,wrap,fail} from '@/lib/server';
import {limit} from '@/lib/auth';
import {recordUsage,usageSummary} from '@/lib/usage';
import {usageLabels} from '@/lib/usage-events';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{origin(req);const m=await member();await limit(req,'usage:'+m.id,240);if(Number(req.headers.get('content-length')||0)>500)fail('Ugyldig statistikk.');const b:any=await req.json();if(!b||typeof b.event!=='string'||!(b.event==='presence'||Object.hasOwn(usageLabels,b.event))||['seconds','session','submit','chat_send'].includes(b.event))fail('Ugyldig statistikk.');await recordUsage(m.id,b.event);return json({ok:true})});
export const GET=wrap(async(req:Request)=>{await admin(req);const p=new URL(req.url).searchParams,days=Number(p.get('days')||7);if(![1,7,30,90].includes(days))fail('Velg 1, 7, 30 eller 90 dager.');return json(await usageSummary(days,p.get('admin')==='1'))});
