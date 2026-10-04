import {featureSuggestions} from '@/lib/feature-suggestions';
import {member,admin,wrap,json,fail} from '@/lib/server';
import {favoritesFor} from '@/lib/favorites';
import {wordBox} from '@/lib/word-box';
import {seasonSummaries} from '@/lib/hunt-summary';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{const m=await member(),view=new URL(req.url).searchParams.get('view');if(view==='favorites')return json({polls:await favoritesFor(m.id,Date.now()),now:Date.now()});if(view==='words'){let isAdmin=false;if(new URL(req.url).searchParams.get('admin')==='1'){await admin(req);isAdmin=true}return json({words:await wordBox(m.id,isAdmin)})}if(view==='features'){const isAdmin=new URL(req.url).searchParams.get('admin')==='1';if(isAdmin)await admin(req);return json({suggestions:await featureSuggestions(m.id,isAdmin)})}if(view==='seasons')return json({summaries:await seasonSummaries(m.id,Date.now())});fail('Ukjent visning.')});
