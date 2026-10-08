import {admin,member,one,wrap,json,fail,str} from '@/lib/server';
import {dictionaryForWord} from '@/lib/word-dictionary';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{await member();await admin(req);const id=str(new URL(req.url).searchParams.get('id'),100),row=await one('SELECT word FROM word_suggestions WHERE id=?',id);if(!row)fail('Forslaget finnes ikke.',404);return json(await dictionaryForWord(row.word))});
