export function challengeWordVisible(c:any,attempt:any,own:any,now:number){
 if(c.lightning)return !!c.start&&c.start<=now;
 return !c.daily||!!attempt||!!own||!!c.end&&c.end<=now;
}
