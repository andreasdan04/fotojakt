import {member,origin,wrap,json} from '@/lib/server';
import {rulesStatus,acceptRules} from '@/lib/rules-acceptance';
import {RULES_SUMMARY,RULES_DETAILS} from '@/lib/rules-content';
export const dynamic='force-dynamic';
export const GET=wrap(async()=>{const m=await member();return json({...await rulesStatus(m.id),summary:RULES_SUMMARY,details:RULES_DETAILS})});
export const POST=wrap(async(req:Request)=>{origin(req);const m=await member();return json(await acceptRules(m.id,await req.json()))});
