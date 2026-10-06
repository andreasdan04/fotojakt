import {all,db,one} from './server';
export const osloDay=(n:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(n);
export async function recordUsage(user:string,event:string,now=Date.now()){
 const day=osloDay(now),d=db();
 if(event==='presence'){
  await d.batch([
   d.prepare("INSERT INTO usage_daily(day,user,event,count) SELECT ?,?,'visit',1 WHERE NOT EXISTS(SELECT 1 FROM usage_activity WHERE user=? AND last_seen>?) ON CONFLICT(day,user,event) DO UPDATE SET count=count+1").bind(day,user,user,now-1800000),
   d.prepare("INSERT INTO usage_daily(day,user,event,count) SELECT ?,?,'seconds',MIN(30,MAX(0,CAST((?-last_seen)/1000 AS INTEGER))) FROM usage_activity WHERE user=? AND last_seen>? ON CONFLICT(day,user,event) DO UPDATE SET count=count+excluded.count").bind(day,user,now,user,now-60000),
   d.prepare('INSERT INTO usage_activity(user,last_seen) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET last_seen=MAX(last_seen,excluded.last_seen)').bind(user,now)
  ]);
 }else await d.prepare('INSERT INTO usage_daily(day,user,event,count) VALUES(?,?,?,1) ON CONFLICT(day,user,event) DO UPDATE SET count=count+1').bind(day,user,event).run();
 const cutoff=osloDay(now-90*86400000),marker='usage-cleanup';
 const cleaned=await one('SELECT value FROM settings WHERE key=?',marker);
 if(cleaned?.value!==day)await d.batch([
  d.prepare('DELETE FROM usage_daily WHERE day<?').bind(cutoff),
  d.prepare('DELETE FROM usage_activity WHERE last_seen<?').bind(now-90*86400000),
  d.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(marker,day)
 ]);
}
export async function usageSummary(days:number,includeAdmin:boolean,now=Date.now()){
 const since=osloDay(now-(days-1)*86400000),today=osloDay(now),filter=includeAdmin?'':'AND m.admin=0';
 const totals=await one(`SELECT COALESCE(SUM(CASE WHEN u.event='visit' THEN u.count ELSE 0 END),0) visits,COUNT(DISTINCT u.user) users,COALESCE(SUM(CASE WHEN u.event='seconds' THEN u.count ELSE 0 END),0) seconds FROM usage_daily u JOIN members m ON m.id=u.user WHERE u.day BETWEEN ? AND ? ${filter}`,since,today);
 const daily=await all(`SELECT u.day,COUNT(DISTINCT u.user) users,SUM(CASE WHEN u.event='visit' THEN u.count ELSE 0 END) visits FROM usage_daily u JOIN members m ON m.id=u.user WHERE u.day BETWEEN ? AND ? ${filter} GROUP BY u.day ORDER BY u.day`,since,today);
 const features=await all(`SELECT u.event,SUM(u.count) count,COUNT(DISTINCT u.user) users FROM usage_daily u JOIN members m ON m.id=u.user WHERE u.day BETWEEN ? AND ? AND u.event NOT IN ('visit','seconds') ${filter} GROUP BY u.event ORDER BY count DESC`,since,today);
 const users=await all(`SELECT m.id,m.name,COALESCE(SUM(CASE WHEN u.event='visit' THEN u.count ELSE 0 END),0) visits,COUNT(DISTINCT u.day) days,COALESCE(SUM(CASE WHEN u.event='seconds' THEN u.count ELSE 0 END),0) seconds,a.last_seen FROM members m LEFT JOIN usage_daily u ON u.user=m.id AND u.day BETWEEN ? AND ? LEFT JOIN usage_activity a ON a.user=m.id WHERE m.status='approved' ${filter} GROUP BY m.id ORDER BY visits DESC,m.name`,since,today);
 const online=await one(`SELECT COUNT(*) n FROM usage_activity a JOIN members m ON m.id=a.user WHERE a.last_seen>? ${filter}`,now-60000);
 return {totals,daily,features,users,online:online.n,since,today,now};
}
