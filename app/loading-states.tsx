'use client';
import {Skeleton} from '@/components/ui/skeleton';

export function LoadingBlock({kind='rows',rows=3,label='Laster innhold'}:{kind?:'rows'|'photos'|'profile'|'hunt'|'feed'|'stats'|'chat'|'settings',rows?:number,label?:string}){
 const row=()=> <div className="loading-row"><Skeleton className="loading-avatar"/><div><Skeleton className="loading-line"/><Skeleton className="loading-line short"/></div><Skeleton className="loading-value"/></div>;
 return <div className={'loading-block loading-'+kind} role="status" aria-label={label} aria-busy="true"><span className="sr-only">{label} …</span><div aria-hidden="true">
 {kind==='photos'?<div className="profile-photo-grid">{Array.from({length:rows*3},(_,i)=><Skeleton key={i} className="loading-photo-tile"/>)}</div>:
 kind==='profile'?<><div className="loading-profile-heading">{row()}</div><Skeleton className="loading-line"/><div className="loading-metrics">{[0,1,2].map(i=><Skeleton key={i} className="loading-stat"/>)}</div><LoadingBlock kind="photos" rows={2}/></>:
 kind==='stats'?<><div className="loading-metrics">{[0,1,2,3].map(i=><Skeleton key={i} className="loading-stat"/>)}</div><LoadingBlock rows={4}/><Skeleton className="loading-table"/></>:
 kind==='hunt'?<><div className="hunt-card loading-hunt-card"><Skeleton className="loading-line short"/><Skeleton className="loading-title"/><Skeleton className="loading-line"/><Skeleton className="loading-clock"/><Skeleton className="loading-button"/></div><div className="loading-metrics">{[0,1,2].map(i=><Skeleton key={i} className="loading-stat"/>)}</div><div className="panel"><LoadingBlock rows={5}/></div></>:
 kind==='feed'?<>{row()}<Skeleton className="loading-feed-image"/><LoadingBlock rows={2}/></>:
 kind==='settings'?<>{[0,1].map(i=><div key={i} className="loading-setting-card"><Skeleton className="loading-line short"/>{[0,1,2].map(j=><Skeleton key={j} className="loading-setting-row"/>)}</div>)}</>:
 kind==='chat'?<>{Array.from({length:rows},(_,i)=><Skeleton key={i} className={'loading-chat-bubble '+(i%2?'mine':'')}/>)}</>:
 <>{Array.from({length:rows},(_,i)=><div key={i}>{row()}</div>)}</>}
 </div></div>;
}

