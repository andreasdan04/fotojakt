import {env} from 'cloudflare:workers';
import {json,wrap,fail} from '@/lib/server';
import {dispatchPush} from '@/lib/push';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{const secret=(env as any).PUSH_SCHEDULER_SECRET;if(!secret||req.headers.get('x-photo-hunt-scheduler-key')!==secret)fail('Unauthorized',401);return json(await dispatchPush())});
