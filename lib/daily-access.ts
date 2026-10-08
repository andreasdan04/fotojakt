import {all,one,fail} from './server';
import {afternoonLocked} from './hunt-times';
export async function requireDailyAccess(c:any,user:string,now=Date.now()){
 if(!c.daily||c.slot!==2)return;
 const attempt=await one('SELECT started FROM starts WHERE challenge=? AND user=?',c.id,user);
 const challenges=await all('SELECT id,daily,slot,day,season FROM challenges WHERE season=? AND day=?',c.season,c.day);
 const submissions=await all('SELECT challenge,user FROM submissions WHERE user=? AND challenge IN(SELECT id FROM challenges WHERE season=? AND day=?)',user,c.season,c.day);
 if(afternoonLocked(c,challenges,submissions,user,now,attempt))fail('Lever formiddagsbildet først. Ettermiddagsjakten åpnes uansett kl. 17.00.',403);
}
