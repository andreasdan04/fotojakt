import {one,fail} from './server';
export const DEFAULT_CHAT_WORDS=['neger','nigger','nigga','heil hitler','sieg heil','drep deg selv','ta livet av deg','jeg skal drepe deg'];
export const normalizeChatText=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('nb-NO').replace(/\p{Cf}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export function cleanChatWords(input:any){
 if(!Array.isArray(input)||input.length>200||input.some(x=>typeof x!=='string'||!x.trim()||x.length>80))fail('Velg opptil 200 ord eller fraser med maks 80 tegn hver.');
 const words=[...new Set(input.map(normalizeChatText))];if(words.some(x=>!x))fail('Ordlisten må inneholde ord, ikke bare tegn.');return words;
}
export function findChatWords(text:string,words:string[]){const normalized=' '+normalizeChatText(text)+' ';return words.filter(word=>normalized.includes(' '+normalizeChatText(word)+' ')).slice(0,10)}
export async function chatWords(){const row=await one("SELECT value FROM settings WHERE key='chat-word-filter'");return row?JSON.parse(row.value).words:DEFAULT_CHAT_WORDS;}
