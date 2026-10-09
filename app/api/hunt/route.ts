import {submissionWindow,ownSubmissionWindows,windowKey} from '@/lib/submission-window';
import {afternoonLocked,osloTime} from '@/lib/hunt-times';
import {requireDailyAccess} from '@/lib/daily-access';
import {ensureGames,gameFor,gameAction,activeTitles,bonusQueue,reviewBonus,processBonuses} from '@/lib/game';
import {ensureWordDescriptions} from '@/lib/word-descriptions';
import {enrollDifficultyNotices,openDifficultyPoll,voteDifficulty,visibleDifficultyPolls,settleDifficultyPolls} from '@/lib/difficulty-polls';
import {replaceWord} from '@/lib/replace-word';
import {applyApprovedWords} from '@/lib/approved-words';
import {uploadPhoto,OFFLINE_GRACE} from '@/lib/upload-photo-server';
import {repairUploadResult} from '@/lib/result-repair';
import {suggestFeature,reviewFeature} from '@/lib/feature-suggestions';
import {huntSummaries} from '@/lib/hunt-summary';
import {voteFavorite} from '@/lib/favorites';
import {suggestWord,reviewWord,assessWord,assessPendingWords} from '@/lib/word-box';
import {releases} from '@/lib/releases';
import {audienceSql,groupAudienceSql,requirePhotoAudience,friendCount} from '@/lib/groups';
import {seasonAnnouncementTime} from '@/lib/push-events';
import {settleReports,visibleReports,reportAction} from '@/lib/photo-reports';
import {queueSocial} from '@/lib/social-push';
import {badgesFor,achievementsFor} from '@/lib/badges';
import {photoProfile} from '@/lib/photo-profile';
import {profileSettings,saveProfileSettings} from '@/lib/profile-settings';
import {createAlbum,startDaily,upgradeFutureDaily,refreshFutureWords} from '@/lib/daily';
import {deleteContent,deleteMember,deleteOwnPhoto} from '@/lib/deletion';
import {notificationStatus} from '@/lib/push';
import {env} from 'cloudflare:workers';
import {currentUser} from '@/lib/auth';
import {all,one,run,db,bucket,identity,member,admin,adminSession,siteOwner,origin,json,wrap,fail,str,rank} from '@/lib/server';
import {roleFor,acceptanceFor} from '@/lib/staff';
import {staff} from '@/lib/server';
import {decideCase} from '@/lib/judging';
import {challengeWordVisible} from '@/lib/challenge-visibility';
import {rulesStatus,requireRulesForNewStart} from '@/lib/rules-acceptance';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{await repairUploadResult();const u=await currentUser();if(!u)return json({user:null});const m=await one('SELECT * FROM members WHERE id=?',u.userId);let rawAdmin=false;try{await adminSession(req);rawAdmin=true}catch{};const agreementAccepted=!!await acceptanceFor(u.userId);const role=await roleFor(u.userId);const isOwner=role==='owner';const adminAccess={session:rawAdmin,accepted:agreementAccepted,isOwner,role};let isAdmin=false;try{await admin(req);isAdmin=true}catch{};if(!m||m.status!=='approved')return json({user:{id:u.userId,name:m?.name||u.fullName||'',status:m?.status||'new'},admin:isAdmin,adminAccess});
const now=Date.now();await ensureGames(now);await settleDifficultyPolls(now);await upgradeFutureDaily(now);await applyApprovedWords(now);await ensureWordDescriptions(now);await settleReports(now);const profileId=new URL(req.url).searchParams.get('profile');if(profileId)return json(await photoProfile(str(profileId,100),m.id,isAdmin,now));const seasons=await all('SELECT * FROM seasons ORDER BY start DESC');const requested=new URL(req.url).searchParams.get('season');const season=seasons.find((s:any)=>s.id===requested)||seasons.find((s:any)=>!s.end&&s.start<=now&&(!s.last_day||s.last_day>=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(now)))||seasons.find((s:any)=>!s.end&&s.start>now)||seasons[0]||null;const challenges=season?await all('SELECT c.*,COALESCE(g.lightning,0) lightning,g.bonus FROM challenges c LEFT JOIN game_hunts g ON g.challenge=c.id WHERE c.season=? ORDER BY c.created DESC',season.id):[];
const audience=await all(`SELECT id FROM members m WHERE status='approved' AND ${audienceSql(m.id,'m.id')}`);const audienceIds=new Set(audience.map((x:any)=>x.id));
const groupAudience=await all(`SELECT id FROM members m WHERE status='approved' AND ${groupAudienceSql(m.id,'m.id')}`);const groupAudienceIds=new Set(groupAudience.map((x:any)=>x.id));
const friendIds=(await all("SELECT m.id FROM friendships f JOIN members m ON m.id=CASE WHEN f.a=? THEN f.b ELSE f.a END WHERE (f.a=? OR f.b=?) AND f.status='accepted' AND m.status='approved'",m.id,m.id,m.id)).map((x:any)=>x.id);
const groups=await all('SELECT g.id,g.name FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE gm.user=? ORDER BY g.name',m.id);
for(const g of groups)g.members=(await all("SELECT gm.user FROM group_members gm JOIN members m ON m.id=gm.user WHERE gm.group_id=? AND m.status='approved'",g.id)).map((x:any)=>x.user);
const groupFeedIds=new Set(groups.flatMap((g:any)=>g.members));
const starts=await all('SELECT * FROM starts WHERE user=?',m.id);const extraWindows=await ownSubmissionWindows(m.id,now);
const released=challenges.filter((c:any)=>c.start&&c.start<=now);const submissions=season?await all(`SELECT s.*,m.name,CASE WHEN b.status='approved' THEN 2 ELSE 0 END bonus_points FROM submissions s JOIN members m ON m.id=s.user JOIN challenges c ON c.id=s.challenge LEFT JOIN bonus_reviews b ON b.submission=s.id WHERE c.season=?`,season.id):[];const allSeasonSubmissions=[...submissions];const scopedSubmissions=submissions.filter((s:any)=>audienceIds.has(s.user));submissions.splice(0,submissions.length,...scopedSubmissions);const allMembers=await all('SELECT id,name,username,approved FROM members WHERE status=?','approved');const members=allMembers.filter((x:any)=>audienceIds.has(x.id));
const approvedIds=new Set(allMembers.map((x:any)=>x.id)),scoringSubmissions=allSeasonSubmissions.filter((s:any)=>approvedIds.has(s.user));
const leaderboard=rank(released,scoringSubmissions,allMembers,now);
const groupLeaderboards=Object.fromEntries(groups.map((g:any)=>[g.id,rank(released,scoringSubmissions.filter((s:any)=>g.members.includes(s.user)),allMembers.filter((x:any)=>g.members.includes(x.id)),now)]));
const myGroupsLeaderboard=rank(released,scoringSubmissions.filter((s:any)=>groupFeedIds.has(s.user)),allMembers.filter((m:any)=>groupFeedIds.has(m.id)),now);
const savedBoardGroup=(await one('SELECT value FROM settings WHERE key=?','leaderboard_filter:'+m.id))?.value||'all';
const scoreboardGroup=['all','my-groups','lightning'].includes(savedBoardGroup)||groups.some((g:any)=>g.id===savedBoardGroup)?savedBoardGroup:'all';
const visible=challenges.filter((c:any)=>isAdmin||(c.start&&c.start<=now)).map((c:any)=>{const own=submissions.find((s:any)=>s.challenge===c.id&&s.user===m.id);const reveal=!!c.start&&c.start<=now&&(!!own||c.end<=now);const attempt=starts.find((x:any)=>x.challenge===c.id);const reopen=extraWindows.find(w=>w.challenge===c.id&&w.revision===c.revision);const locked=!reopen&&afternoonLocked(c,challenges,allSeasonSubmissions,m.id,now,attempt);const wordVisible=!locked&&challengeWordVisible(c,attempt,own,now);return {...c,reopen:reopen?{id:reopen.id,expires:reopen.expires,created:reopen.created}:null,locked,available:!!reopen||!!c.start&&c.start<=now&&c.end>now&&!locked,unlockAt:locked?osloTime(c.day,17):null,bonus:wordVisible?c.bonus:null,title:wordVisible?c.title:c.lightning?'Hemmelige lynjaktord':'Dagens hemmelige ord',details:wordVisible?c.details:c.lightning?'Ordet avsløres når lynjakten starter.':'Start for å se ordet. Da begynner din klokke.',started:attempt?.started||null,own:own?{id:own.id,elapsed:own.elapsed,valid:own.valid,caption:own.caption}:null,eligible:!!c.daily||m.approved<=c.start,count:submissions.filter((s:any)=>s.challenge===c.id).length,friendCount:submissions.filter((s:any)=>s.challenge===c.id&&friendIds.includes(s.user)).length,groupFeedCount:submissions.filter((s:any)=>s.challenge===c.id&&groupFeedIds.has(s.user)).length,groupCounts:Object.fromEntries(groups.map((g:any)=>[g.id,submissions.filter((s:any)=>s.challenge===c.id&&g.members.includes(s.user)).length])),reveal,submissions:reveal?submissions.filter((s:any)=>s.challenge===c.id).sort((a:any,b:any)=>b.valid-a.valid||a.elapsed-b.elapsed||a.submitted-b.submitted||a.id.localeCompare(b.id)).map(({key,...s}:any)=>s):[]}});
const reactions=season?await all('SELECT r.submission,r.emoji,COUNT(*) count,MAX(CASE WHEN r.user=? THEN 1 ELSE 0 END) mine FROM reactions r JOIN submissions s ON s.id=r.submission JOIN challenges c ON c.id=s.challenge WHERE c.season=? AND (c.end<=? OR EXISTS (SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) ) GROUP BY r.submission,r.emoji',m.id,season.id,now,m.id):[];
const reactors=season?await all('SELECT r.submission,r.emoji,r.user id,m.name FROM reactions r JOIN members m ON m.id=r.user JOIN submissions s ON s.id=r.submission JOIN challenges c ON c.id=s.challenge WHERE c.season=? AND (c.end<=? OR EXISTS (SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) )',season.id,now,u.userId):[];
for(const reaction of reactions)reaction.users=reactors.filter((r:any)=>r.submission===reaction.submission&&r.emoji===reaction.emoji).map(({id,name}:any)=>({id,name}));
const comments=season?await all('SELECT x.*,m.name FROM comments x JOIN members m ON m.id=x.user JOIN submissions s ON s.id=x.submission JOIN challenges c ON c.id=s.challenge WHERE c.season=? AND (c.end<=? OR EXISTS (SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) ) ORDER BY x.created,x.id',season.id,now,u.userId):[];
const titles=await activeTitles();
await processBonuses(now);const game=await gameFor(m.id,now);
const lightningBoard=rank(released.filter((c:any)=>c.lightning),scoringSubmissions,allMembers,now).filter((r:any)=>r.done);
const upcoming=await all(`SELECT c.id,c.start,c.end,c.duration,c.daily FROM challenges c JOIN seasons s ON s.id=c.season WHERE s.end IS NULL AND c.start>? AND (c.id NOT LIKE 'lightning:%' OR c.start<=?+1800000) ORDER BY c.start LIMIT 5`,now,now);
const avatarVersions=Object.fromEntries((await all('SELECT user,updated FROM avatars')).map((a:any)=>[a.user,a.updated]));const badges=await badgesFor(m.id,now);
// Announce the current season independently of the album being browsed.
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Oslo'}).format(now);
const currentSeason=seasons.find((s:any)=>!s.end&&s.start<=now&&(!s.last_day||s.last_day>=today));
let seasonWelcome=null;
if(currentSeason&&now>=seasonAnnouncementTime(currentSeason.start)&&Number(new Intl.DateTimeFormat('en',{timeZone:'Europe/Oslo',hour:'2-digit',hourCycle:'h23'}).format(now))>=6){
 const previous=seasons.find((s:any)=>s.start<currentSeason.start&&(s.end&&s.end<=now||s.last_day&&s.last_day<today));
 let winner=null;
 if(previous){
  const previousChallenges=await all('SELECT * FROM challenges WHERE season=? AND start IS NOT NULL AND end<=?',previous.id,now);
  const previousSubmissions=await all(`SELECT s.*,CASE WHEN b.status='approved' THEN 2 ELSE 0 END bonus_points FROM submissions s LEFT JOIN bonus_reviews b ON b.submission=s.id JOIN challenges c ON c.id=s.challenge WHERE c.season=? AND c.end<=?`,previous.id,now);
  winner=rank(previousChallenges,previousSubmissions.filter((s:any)=>groupAudienceIds.has(s.user)),members.filter((x:any)=>groupAudienceIds.has(x.id)),now).find((r:any)=>r.points>0)||null;
 }
 seasonWelcome={id:currentSeason.id,name:currentSeason.name,previous:previous?{name:previous.name,winner}:null};
}
const response={rules:await rulesStatus(m.id),game:{...game,aiEnabled:false,bonusReviewMode:'manual',chatModerationMode:'word-list'},titles,lightningBoard,bonusQueue:isAdmin?await bonusQueue(m.id):undefined,lightningWarning:challenges.filter((c:any)=>c.lightning&&c.start>now&&c.start<=now+1800000).map((c:any)=>({id:c.id,start:c.start})),difficultyPolls:await visibleDifficultyPolls(m.id,now),summaries:huntSummaries(released,submissions.filter((s:any)=>groupAudienceIds.has(s.user)),members.filter((x:any)=>groupAudienceIds.has(x.id)),m.id,now),releases,groups,friendIds,seasonWelcome,reports:await visibleReports(m.id,isAdmin,now,season?.id||null),achievements:await achievementsFor(m.id,now),avatarVersions,badges,user:{...m,settings:await profileSettings(m.id),friendCount:await friendCount(m.id),login:(await one('SELECT login FROM local_accounts WHERE user=?',m.id))?.login},admin:isAdmin,adminAccess,now:Date.now(),season,seasons,upcoming,push:await notificationStatus(),challenges:visible,leaderboard,groupLeaderboards,myGroupsLeaderboard,scoreboardGroup,reactions:reactions.filter((r:any)=>submissions.some((s:any)=>s.id===r.submission)),comments:comments.filter((r:any)=>submissions.some((s:any)=>s.id===r.submission)),members:isAdmin?await all('SELECT m.*,a.login,(SELECT COUNT(*) FROM push_subscriptions p WHERE p.user=m.id) pushDevices FROM members m LEFT JOIN local_accounts a ON a.user=m.id ORDER BY m.joined DESC'):undefined};response.now=Date.now();return json(response);});
export const POST=wrap(async(req:Request)=>{origin(req);const u=await identity();await settleDifficultyPolls();const type=req.headers.get('content-type')||'';
if(type.includes('multipart/form-data'))return uploadPhoto(req,await member());
const b:any=await req.json();if(!b||typeof b!=='object')fail('Ugyldig forespørsel.');const now=Date.now();
if(b.action==='delete-own-photo'){const m=await member();return json(await deleteOwnPhoto(b.id,m.id))}
if(b.action==='logout-admin'){await adminSession(req);await run('DELETE FROM sessions WHERE user=?',u.userId);return json({ok:true})}
const m=await member();if(['start-daily','camera','taken'].includes(b.action))await upgradeFutureDaily(now);
if(['game-seen','active-title'].includes(b.action))return json(await gameAction(b,m.id));
if(b.action==='leaderboard-filter'){const group=str(b.group,100);if(!['all','my-groups','lightning'].includes(group)&&!await one('SELECT g.id FROM groups g JOIN group_members gm ON gm.group_id=g.id WHERE g.id=? AND gm.user=?',group,m.id))fail('Du har ikke tilgang til denne gruppens poengtavle.',403);await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value','leaderboard_filter:'+m.id,group);return json({ok:true,scoreboardGroup:group})}
if(b.action==='vote-difficulty')return json(await voteDifficulty(b,m.id,now));
if(b.action==='vote-favorite')return json(await voteFavorite(b,m.id,now));
if(b.action==='suggest-feature')return json(await suggestFeature(b,m.id,now));
if(b.action==='suggest-word')return json(await suggestWord(b,m.id,now));
if(b.action==='caption'){const id=str(b.id,100),caption=typeof b.caption==='string'?b.caption.trim():'';if(caption.length>120)fail('Bildeteksten kan ha maks 120 tegn.');const changed=await run('UPDATE submissions SET caption=? WHERE id=? AND user=?',caption,id,m.id);if(!changed.meta.changes)fail('Du kan bare redigere bildeteksten på egne bilder.',403);return json({ok:true});}
if(b.action==='profile-settings'){
 const bio=typeof b.bio==='string'?b.bio.trim():'';if(bio.length>160)fail('Bio kan ha maks 160 tegn.');
 const featuredBadge=typeof b.featuredBadge==='string'?b.featuredBadge:'';
 if(featuredBadge&&!(await achievementsFor(m.id,now)).badges.some((badge:any)=>badge.id===featuredBadge&&badge.earned))fail('Velg et merke du har opptjent.');
 await saveProfileSettings(m.id,{...await profileSettings(m.id),bio,featuredBadge,showFriendCount:b.showFriendCount!==false});return json({ok:true});
}
if(b.action==='appearance'){if(!['light','dark','system'].includes(b.theme))fail('Velg et gyldig fargetema.');await saveProfileSettings(m.id,{...await profileSettings(m.id),theme:b.theme});return json({ok:true});}
if(b.action==='report-photo'||b.action==='vote-photo')return json(await reportAction(b,m.id,now));
if(b.action==='start-daily'){const id=str(b.id,100),w=await submissionWindow(id,m.id,now);if(w){await requireRulesForNewStart(m.id,id);const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND c.revision=? AND s.end IS NULL',id,w.revision);if(!c)fail('Jakten er endret.',409);await run('INSERT OR IGNORE INTO starts(challenge,user,started) VALUES(?,?,?)',id,m.id,now);const a=await one('SELECT started FROM starts WHERE challenge=? AND user=?',id,m.id);return json({title:c.title,details:c.details,started:a.started,revision:c.revision,now:Date.now()});}await requireRulesForNewStart(m.id,id);await ensureWordDescriptions();const result=await startDaily(id,m);await enrollDifficultyNotices();return json({...result,now:Date.now()});}
if(b.action==='taken'){const cap=await one('SELECT p.*,c.end,c.daily FROM captures p JOIN challenges c ON c.id=p.challenge JOIN seasons s ON s.id=c.season WHERE p.token=? AND p.user=? AND p.used=0 AND p.expires>? AND s.end IS NULL',b.token,m.id,now);const w=cap?await submissionWindow(cap.challenge,m.id,now):null,ref=cap?await one('SELECT value FROM settings WHERE key=?','submission-window-capture:'+cap.token):null;if(!cap||!cap.daily||!(ref&&w?.id===ref.value||!ref&&cap.end>now))fail('Kameraøkten er utløpt.');const a=await one('SELECT started FROM starts WHERE user=? AND challenge=?',m.id,cap.challenge);if(!a)fail('Start dagens ord først.');await run('UPDATE captures SET taken=? WHERE token=? AND used=0',now,b.token);return json({ok:true,elapsed:now-a.started,taken:now})}
if(b.action==='profile'){await run('UPDATE members SET name=? WHERE id=?',str(b.name,40),u.userId);return json({ok:true})}
if(b.action==='camera'){
 const c=await one('SELECT c.* FROM challenges c JOIN seasons s ON s.id=c.season WHERE c.id=? AND s.end IS NULL',b.id),w=c?await submissionWindow(c.id,m.id,now):null;
 if(!c||!c.start||c.start>now||(!w&&c.end<=now)||(!w&&!c.daily&&m.approved>c.start)||w&&w.revision!==c.revision)fail('Jakten er ikke åpen.');
 if(!w)await requireDailyAccess(c,m.id,now);
 const attempt=c.daily?await one('SELECT started FROM starts WHERE user=? AND challenge=?',m.id,c.id):null;if(c.daily&&!attempt)fail('Start og vis dagens ord først.');
 const token=crypto.randomUUID(),deadline=w?.expires??c.end;
 const inserted=await run('INSERT INTO captures(token,user,challenge,expires,used,issued,revision) SELECT ?,?,?,?,0,?,? WHERE EXISTS(SELECT 1 FROM challenges WHERE id=? AND revision=?) AND (?=0 OR EXISTS(SELECT 1 FROM starts WHERE challenge=? AND user=?))',token,u.userId,c.id,w?deadline:deadline+OFFLINE_GRACE,now,c.revision,c.id,c.revision,c.daily,c.id,m.id);
 if(!inserted.meta.changes)fail('Jaktordet er byttet. Start jakten på nytt.',409);
 if(w)await run('INSERT INTO settings(key,value) SELECT ?,? WHERE EXISTS(SELECT 1 FROM settings WHERE key=? AND json_extract(value,"$.id")=?)','submission-window-capture:'+token,w.id,windowKey(c.id,m.id),w.id);
 return json({token,now:Date.now(),started:attempt?.started||c.start,end:deadline,revision:c.revision,windowId:w?.id});
}
if(b.action==='react'||b.action==='comment'){
 const id=str(b.id,100);await requirePhotoAudience(id,m.id);
 const photo=await one('SELECT s.id FROM submissions s JOIN challenges c ON c.id=s.challenge WHERE s.id=? AND (c.end<=? OR EXISTS (SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?))',id,now,u.userId);
 if(!photo)fail('Lever ditt eget bilde først, eller vent til jakten er ferdig.',403);
 if(b.action==='comment'){
  const body=str(b.body,500);let parentId=null,replyTo=null;
  if(b.parent){const parent=await one('SELECT id,parent_id FROM comments WHERE id=? AND submission=? AND deleted=0',str(b.parent,100),id);if(!parent)fail('Kommentaren finnes ikke lenger.');parentId=parent.parent_id||parent.id;replyTo=parent.id;}

  if(await one('SELECT id FROM comments WHERE user=? AND created>? LIMIT 1',u.userId,now-2000))fail('Vent et øyeblikk før neste kommentar.',429);
  const commentId=crypto.randomUUID();await run('INSERT INTO comments(id,submission,user,body,created,parent_id,reply_to) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM submissions WHERE id=?)',commentId,id,u.userId,body,now,parentId,replyTo,id);await queueSocial('comment',id,u.userId,commentId);
 }else{
  if(!['👍','🔥','😂','❤️','👏','😮','😢'].includes(b.emoji))fail('Ugyldig reaksjon.');
  const old=await one('SELECT id,emoji FROM reactions WHERE submission=? AND user=?',id,u.userId);
  if(old?.emoji===b.emoji)await run('DELETE FROM reactions WHERE submission=? AND user=? AND emoji=?',id,u.userId,b.emoji);
  else {await run('INSERT INTO reactions(id,submission,user,emoji) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM submissions WHERE id=?) ON CONFLICT(submission,user) DO UPDATE SET emoji=excluded.emoji',crypto.randomUUID(),id,u.userId,b.emoji,id);await queueSocial('reaction',id,u.userId,b.emoji);}

 }
 return json({ok:true});
}
if(b.action==='delete-comment'){
 const comment=await one('SELECT user FROM comments WHERE id=?',str(b.id,100));if(!comment)fail('Kommentaren er allerede slettet.');
 if(comment.user!==u.userId)await admin(req);
 await run("UPDATE comments SET body='',deleted=1 WHERE id=?",b.id);return json({ok:true});
}
if(b.action==='review-bonus')return json(await decideCase({...b,kind:'bonus'},await staff(req)));
await admin(req);
if(['album','season','end-season','refresh-words','replace-word','open-difficulty-poll','delete-challenge','delete-season','delete-member','member','challenge','release','end-challenge','result','review-feature','assess-words','assess-word','review-word'].includes(b.action))await siteOwner(req);
if(b.action==='open-difficulty-poll')return json(await openDifficultyPoll(b,u.userId,now));
if(b.action==='replace-word')return json(await replaceWord(b,u.userId));
if(b.action==='review-feature')return json(await reviewFeature(b));
if(b.action==='assess-words')return json(await assessPendingWords());
if(b.action==='assess-word')return json(await assessWord(str(b.id,100)));
if(b.action==='review-word')return json(await reviewWord(b));
if(b.action==='delete-member'){await deleteMember(b.id,u.userId);return json({ok:true})}
if(b.action==='refresh-words')return json(await refreshFutureWords());
if(b.action==='album')return json(await createAlbum(b));
if(['delete-photo','delete-challenge','delete-season'].includes(b.action)){const photo=b.action==='delete-photo'?await one('SELECT user,challenge FROM submissions WHERE id=?',b.id):null;await deleteContent(b.action.slice(7),b.id);return json({ok:true,...(photo?{resetUser:photo.user,resetChallenge:photo.challenge}:{})})}
if(b.action==='member'){if(!['approved','blocked'].includes(b.status))fail('Ugyldig status.');await run('UPDATE members SET status=?,approved=CASE WHEN ?=? THEN COALESCE(approved,?) ELSE approved END WHERE id=? AND admin=0',b.status,b.status,'approved',now,b.id);if(b.status==='blocked'&&await one('SELECT id FROM members WHERE id=? AND admin=0',b.id)){await db().batch([db().prepare('DELETE FROM login_sessions WHERE user=?').bind(b.id),db().prepare('DELETE FROM sessions WHERE user=?').bind(b.id),db().prepare('DELETE FROM push_subscriptions WHERE user=?').bind(b.id)]);}return json({ok:true})}
if(b.action==='season'){if(await one('SELECT id FROM seasons WHERE end IS NULL'))fail('Avslutt nåværende sesong først.');await run('INSERT INTO seasons(id,name,start) VALUES (?,?,?)',crypto.randomUUID(),str(b.name,70),now);return json({ok:true})}
if(b.action==='end-season'){await db().batch([db().prepare('UPDATE seasons SET end=? WHERE id=? AND end IS NULL').bind(now,b.id),db().prepare('UPDATE challenges SET end=MIN(end,?) WHERE season=? AND start<=?').bind(now,b.id,now),db().prepare('UPDATE challenges SET start=NULL,end=NULL WHERE season=? AND start>?').bind(b.id,now)]);return json({ok:true})}
if(b.action==='challenge'){const season=await one('SELECT id FROM seasons WHERE end IS NULL');if(!season)fail('Start en sesong først.');const duration=Number(b.minutes)*60000;if(!Number.isFinite(duration)||duration<60000||duration>604800000)fail('Velg mellom 1 minutt og 7 dager.');let start=b.mode==='now'?now:b.mode==='schedule'?Date.parse(b.start):null;if(b.mode==='schedule'&&(!Number.isFinite(start)||start!<now))fail('Velg et tidspunkt i fremtiden.');await run('INSERT INTO challenges(id,season,title,details,start,end,duration,created) VALUES (?,?,?,?,?,?,?,?)',crypto.randomUUID(),season.id,str(b.title),String(b.details||'').slice(0,1000),start,start?start+duration:null,duration,now);return json({ok:true})}
if(b.action==='release'){await run('UPDATE challenges SET start=?,end=?+duration WHERE daily=0 AND id=? AND (start IS NULL OR start>?) AND season IN (SELECT id FROM seasons WHERE end IS NULL)',now,now,b.id,now);return json({ok:true})}
if(b.action==='end-challenge'){await run('UPDATE challenges SET end=? WHERE id=? AND start<=? AND end>?',now,b.id,now,now);return json({ok:true})}
if(b.action==='result'){const actor=await siteOwner(req),s=await one('SELECT * FROM submissions WHERE id=?',str(b.id,100));if(!s)fail('Fant ikke resultatet.',404);if(typeof b.valid!=='boolean')fail('Velg gyldig eller ugyldig.');const previous=await one("SELECT id FROM review_decisions WHERE submission=? AND kind='photo' AND current=1",s.id);return json(await decideCase({kind:'photo',id:s.id,status:b.valid?'approved':'rejected',reason:str(b.note,300),elapsed:Math.round(Number(b.seconds)*1000),expectedValid:!!s.valid,expectedNote:s.note,override:!!previous,decision:previous?.id,administrative:true},actor));}
fail('Ukjent handling.');});
