import {all,db,one} from './server';
import {osloDay,nextDay} from './hunt-times';
export {osloDay} from './hunt-times';
export async function recordUsage(user:string,event:string,now=Date.now()){
 if(event==='presence')event='visit';
 const d=db(),consent="EXISTS(SELECT 1 FROM settings WHERE key='privacy:'||? AND json_extract(value,'$.analytics')=1)",day=osloDay(now);
 // One short-lived timestamp per consenting account; never exposed to admins.
 // Atomic batches serialize simultaneous tabs and withdrawal with session counting.
 await d.batch([
  d.prepare(`INSERT INTO usage_daily(day,user,event,count) SELECT ?,?,'session',1 WHERE ${consent} AND NOT EXISTS(SELECT 1 FROM usage_activity WHERE user=? AND last_seen>?) ON CONFLICT(day,user,event) DO UPDATE SET count=count+1`).bind(day,user,user,user,now-1800000),
  d.prepare(`INSERT INTO usage_activity(user,last_seen) SELECT ?,? WHERE ${consent} ON CONFLICT(user) DO UPDATE SET last_seen=MAX(last_seen,excluded.last_seen)`).bind(user,now,user),
  d.prepare(`INSERT INTO usage_daily(day,user,event,count) SELECT ?,?,?,1 WHERE ${consent} ON CONFLICT(day,user,event) DO UPDATE SET count=count+1`).bind(day,user,event,user)
 ]);
}
export async function usageSummary(days:number,includeAdmin:boolean,now=Date.now()){
 const today=osloDay(now),since=new Date(Date.parse(today+'T12:00:00Z')-(days-1)*86400000).toISOString().slice(0,10);
 const filter="AND EXISTS(SELECT 1 FROM settings WHERE key='privacy:'||m.id AND json_extract(value,'$.analytics')=1)"+(includeAdmin?'':' AND m.admin=0');
 const consent=await one(`SELECT COUNT(*) count FROM members m WHERE m.status='approved' ${filter}`);
 const totals=await one(`SELECT COALESCE(SUM(CASE WHEN u.event='visit' THEN u.count ELSE 0 END),0) visits,COUNT(DISTINCT u.user) users,COALESCE(SUM(CASE WHEN u.event='session' THEN u.count ELSE 0 END),0) sessions FROM usage_daily u JOIN members m ON m.id=u.user WHERE m.status='approved' AND u.day BETWEEN ? AND ? ${filter}`,since,today);
 const rows=await all(`SELECT u.day,COUNT(DISTINCT u.user) users,SUM(CASE WHEN u.event='visit' THEN u.count ELSE 0 END) visits,SUM(CASE WHEN u.event='session' THEN u.count ELSE 0 END) sessions FROM usage_daily u JOIN members m ON m.id=u.user WHERE m.status='approved' AND u.day BETWEEN ? AND ? ${filter} GROUP BY u.day ORDER BY u.day`,since,today);
 const features=await all(`SELECT u.event,SUM(u.count) count,COUNT(DISTINCT u.user) users FROM usage_daily u JOIN members m ON m.id=u.user WHERE m.status='approved' AND u.day BETWEEN ? AND ? AND u.event NOT IN ('visit','seconds','session') ${filter} GROUP BY u.event ORDER BY count DESC`,since,today);
 const daily=[];for(let day=since;day<=today;day=nextDay(day))daily.push(rows.find((x:any)=>x.day===day)||{day,users:0,visits:0,sessions:0});
 return {totals:{...totals,consented:consent.count},daily,features,users:[],online:0,suppressed:false,since,today,now};
}
