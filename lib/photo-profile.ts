import {activeTitles} from './game';
import {audienceSql,friendCount} from './groups';
import {visibleReports} from './photo-reports';
import {badgesFor,achievementsFor} from './badges';
import {all,one,fail} from './server';
import {profileSettings} from './profile-settings';
export async function photoProfile(user:string,viewer:string,isAdmin:boolean,now:number){
 const profile=await one("SELECT id,name,username FROM members WHERE id=? AND status='approved'",user);if(!profile)fail('Fant ikke deltakeren.',404);
 const canSeePhotos=!!await one(`SELECT m.id FROM members m WHERE m.id=? AND ${audienceSql(viewer,'m.id')}`,user);
 const friendship=user===viewer?null:await one('SELECT status,requester FROM friendships WHERE (a=? AND b=?) OR (a=? AND b=?)',user,viewer,viewer,user);
 const badges=await badgesFor(user,now),avatar=await one('SELECT updated FROM avatars WHERE user=?',user);
 const settings=await profileSettings(user);
 const summary={profile:{...profile,title:(await activeTitles())[user]||'',settings:user===viewer?settings:{bio:settings.bio,featuredBadge:settings.featuredBadge,showFriendCount:settings.showFriendCount},avatarVersion:avatar?.updated,friendCount:settings.showFriendCount?await friendCount(user):null},friendship,canSeePhotos,badges,achievements:await achievementsFor(user,now,viewer,isAdmin)};
 if(!canSeePhotos)return {...summary,photos:[],reactions:[],comments:[],reports:[]};
 const access='(c.end<=? OR EXISTS (SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) )';
 const args=[user,now,viewer];
 const photos=await all(`SELECT s.id,s.user,s.challenge,s.elapsed,s.valid,s.note,s.caption,s.submitted,m.name,c.title,c.day,c.start,c.end,a.name album,EXISTS(SELECT 1 FROM submissions own WHERE own.challenge=c.id AND own.user=?) own FROM submissions s JOIN members m ON m.id=s.user JOIN challenges c ON c.id=s.challenge JOIN seasons a ON a.id=c.season WHERE s.user=? AND ${access} ORDER BY c.start DESC,s.submitted DESC`,viewer,...args);
 const raw=await all(`SELECT r.submission,r.emoji,r.user,m.name FROM reactions r JOIN members m ON m.id=r.user JOIN submissions s ON s.id=r.submission JOIN challenges c ON c.id=s.challenge WHERE s.user=? AND ${access}`,...args);
 const reactions:any[]=[];for(const r of raw){let group=reactions.find(x=>x.submission===r.submission&&x.emoji===r.emoji);if(!group){group={submission:r.submission,emoji:r.emoji,count:0,mine:0,users:[]};reactions.push(group)}group.count++;group.mine ||= r.user===viewer?1:0;group.users.push({id:r.user,name:r.name})}
 const comments=await all(`SELECT x.*,m.name FROM comments x JOIN members m ON m.id=x.user JOIN submissions s ON s.id=x.submission JOIN challenges c ON c.id=s.challenge WHERE s.user=? AND ${access} ORDER BY x.created,x.id`,...args);
 return {...summary,reports:await visibleReports(viewer,isAdmin,now,null,user),photos,reactions,comments};
}
