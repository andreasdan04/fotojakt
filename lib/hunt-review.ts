import {one,fail} from './server';
export function canReviewHunt(c:any,own:boolean,now=Date.now()){
 return !!c.start&&c.start<=now&&(!!c.end&&c.end<=now||own);
}
export async function requireHuntReview(challenge:string,reviewer:string,now=Date.now()){
 const c=await one('SELECT c.*,EXISTS(SELECT 1 FROM submissions WHERE challenge=c.id AND user=?) own FROM challenges c WHERE c.id=?',reviewer,challenge);
 if(!c)fail('Jakten finnes ikke.',404);
 if(!canReviewHunt(c,!!c.own,now))fail('Lever ditt eget bilde først, eller vent til jakten er avsluttet før du kontrollerer andres innleveringer.',403);
 return c;
}
