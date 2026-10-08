import {staff,origin,wrap,json} from '@/lib/server';
import {judgingQueue,decideCase,resolveAppeal,type ReviewInput} from '@/lib/judging';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>json(await judgingQueue(await staff(req))));
export const POST=wrap(async(req:Request)=>{origin(req);const actor=await staff(req),b=await req.json() as ReviewInput;return json(b.action==='resolve-appeal'?await resolveAppeal(b,actor):await decideCase(b,actor));});
