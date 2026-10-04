'use client';
import {useEffect,useState} from 'react';
import {ArrowDown,CheckCircle2} from 'lucide-react';
type ReleaseTag='Bugfiks'|'Nyhet'|'Endring';
type Release={version:number,date:string,summary:string,tags?:ReleaseTag[],changes?:{type:ReleaseTag,text:string}[]};
export function UpdateNotice({releases,user}:{releases:Release[],user:string}){
 const latest=releases[0]?.date;
 const [unread,setUnread]=useState(false);
 const key='foto-jakt-daily-release-read:'+user;
 useEffect(()=>{try{setUnread(!!latest&&localStorage.getItem(key)!==latest)}catch{setUnread(!!latest)}},[key,latest]);
 function open(){
  const section=document.getElementById('endringslogg');if(!section)return;
  section.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  section.focus({preventScroll:true});
  try{localStorage.setItem(key,String(latest))}catch{}
  setUnread(false);
 }
 if(!unread)return null;
 return <button className="update-notice" onClick={open} aria-controls="endringslogg"><CheckCircle2 size={22}/><span><strong>Foto Jakt er oppdatert</strong><small>Versjon {releases[0]?.version} · Dagens oppsummering</small></span><ArrowDown size={20}/></button>;
}
export function Changelog({releases}:{releases:Release[]}){
 const [showPrevious,setShowPrevious]=useState(false);
 const tag=(type:ReleaseTag)=><span className={'release-tag release-tag-'+(type==='Bugfiks'?'fix':type==='Nyhet'?'new':'change')}>{type==='Nyhet'?'Nyheter':type==='Bugfiks'?'Bugfikser':'Endringer'}</span>;
 const item=(r:Release)=><article className="release-item" key={r.date}><div><strong>Versjon {r.version}</strong><time dateTime={r.date}>{new Date(r.date+'T12:00:00Z').toLocaleDateString('nb-NO',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Oslo'})}</time></div>{r.changes?.length?<div className="release-changes">{(['Nyhet','Endring','Bugfiks'] as ReleaseTag[]).map(type=>{const entries=r.changes!.filter(change=>change.type===type);return entries.length?<section className="release-group" key={type}>{tag(type)}<ul>{entries.map((change,i)=><li key={i}>{change.text}</li>)}</ul></section>:null})}</div>:<><div className="release-tags">{(r.tags||['Endring']).map(type=><span key={type}>{tag(type)}</span>)}</div><p>{r.summary}</p></>}</article>;
 return <section id="endringslogg" className="changelog panel" tabIndex={-1} aria-labelledby="changelog-heading"><div className="section-title !mt-0"><h2 id="changelog-heading">Nytt i Foto Jakt</h2><span className="badge">v{releases[0]?.version}</span></div>{releases.slice(0,1).map(item)}{releases.length>1&&<><button className="button w-full mt-4" aria-expanded={showPrevious} aria-controls="tidligere-oppdateringer" onClick={()=>setShowPrevious(v=>!v)}>{showPrevious?'Skjul tidligere oppdateringer':'Vis tidligere oppdateringer'}</button><div id="tidligere-oppdateringer" hidden={!showPrevious}>{showPrevious&&releases.slice(1).map(item)}</div></>}</section>;
}
