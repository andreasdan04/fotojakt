import {audienceSql} from './groups';
import {achievementsFrom} from './achievements';
import {all,rank} from './server';
import {osloDay} from './daily';
export async function badgesFor(user:string,now:number){
 const seasons=await all('SELECT DISTINCT a.* FROM seasons a JOIN challenges c ON c.season=a.id JOIN submissions s ON s.challenge=c.id WHERE s.user=? ORDER BY a.start DESC',user);
 if(!seasons.length)return [];
 const members=await all(`SELECT m.id,m.name,m.approved FROM members m WHERE m.status='approved' AND ${audienceSql(user,'m.id')}`);
 const badges=[];
 for(const season of seasons){
  let place=null;
  const finished=!!season.end||!!(season.last_day&&season.last_day<osloDay(now));
  if(finished){
   const challenges=await all('SELECT * FROM challenges WHERE season=? AND start IS NOT NULL AND start<=?',season.id,now);
   const submissions=await all(`SELECT s.*,CASE WHEN b.status='approved' THEN 2 ELSE 0 END bonus_points FROM submissions s LEFT JOIN bonus_reviews b ON b.submission=s.id JOIN challenges c ON c.id=s.challenge WHERE c.season=?`,season.id);
   const table=rank(challenges,submissions.filter((s:any)=>members.some((m:any)=>m.id===s.user)),members,now);const position=table.findIndex((r:any)=>r.id===user);
   if(position>=0&&table[position].done>0)place=position+1;
  }
  badges.push({id:season.id,title:season.name,album:season.name,start:season.start,place,finished});
 }
 return badges;
}

export async function achievementsFor(user:string,now:number,viewer=user,isAdmin=false){
 const photos=await all(`SELECT s.challenge,s.valid,s.elapsed,s.submitted,c.start,c.end,c.day,c.slot,c.season,
 CASE WHEN s.valid=1 AND c.end<=? THEN 1+(SELECT COUNT(*) FROM submissions other WHERE other.challenge=s.challenge AND other.valid=1 AND ${audienceSql(user,'other.user')} AND (other.elapsed<s.elapsed OR (other.elapsed=s.elapsed AND (other.submitted<s.submitted OR (other.submitted=s.submitted AND other.id<s.id))))) ELSE NULL END place
 FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE c.id NOT LIKE 'lightning:%' AND s.user=? AND c.start<=? AND (c.end<=? OR EXISTS (SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) OR ?=1)`,now,user,now,now,viewer,isAdmin?1:0);
 const hunts=await all(`SELECT c.id,c.start,c.end,EXISTS(SELECT 1 FROM submissions s WHERE s.challenge=c.id AND s.user=? AND s.valid=1 AND (c.end<=? OR EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) OR ?=1)) valid FROM challenges c JOIN members m ON m.id=? WHERE c.id NOT LIKE 'lightning:%' AND c.start<=? AND ((c.daily=1 AND c.end>m.approved) OR (c.daily=0 AND c.start>=m.approved)) ORDER BY c.start`,user,now,viewer,isAdmin?1:0,user,now);
 return achievementsFrom(photos,now,hunts);
}
