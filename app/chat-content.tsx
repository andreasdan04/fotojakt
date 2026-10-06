'use client';
import {useState} from 'react';
import {FileText,Link2,ExternalLink} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
export function ChatLinks({body}:{body:string}){
 const links:string[]=[];for(const match of body.matchAll(/https?:\/\/[^\s<>]+/gi)){try{const u=new URL(match[0].replace(/[),.!?;]+$/,''));if(u.username||u.password||!['https:','http:'].includes(u.protocol))continue;if(!links.includes(u.href))links.push(u.href);if(links.length===3)break}catch{}}
 return <div className="chat-link-cards">{links.map(url=>{const u=new URL(url);return <a className="chat-link-card" href={url} target="_blank" rel="noopener noreferrer" key={url}><Link2 size={20}/><span><strong>{u.hostname}</strong><small>{u.pathname==='/'?'Åpne lenke':u.pathname.slice(0,100)}</small></span><ExternalLink size={16}/></a>})}</div>;
}
export function ChatMedia({message,review=false}:any){
 const [image,setImage]=useState<{url:string,label:string}|null>(null),suffix=review?'?review=1':'',photoUrl='/api/chat/photo/'+message.id+suffix;
 const picture=(url:string,label:string)=><button className="chat-image" type="button" onClick={()=>setImage({url,label})}><img src={url} alt={label} loading="lazy"/></button>;
 return <><div className="chat-media">{message.photo&&<div className="chat-shared-photo">{picture(photoUrl,'Bildet til '+message.photo.name)}<small>📸 {message.photo.name} · {message.photo.title}</small>{message.photo.caption&&<p>{message.photo.caption}</p>}</div>}{message.sharedUnavailable&&<p className="muted">Det delte jaktbildet er ikke lenger tilgjengelig.</p>}{message.attachments?.map((a:any)=>{const url='/api/chat/attachments/'+a.id+suffix;return <div key={a.id}>{a.mime.startsWith('image/')?picture(url,a.name):<a className="chat-file" href={url} target="_blank" rel="noopener noreferrer"><FileText size={22}/><span><strong>{a.name}</strong><small>{(a.size/1000000).toFixed(1)} MB · Åpne fil</small></span></a>}</div>})}</div><Dialog open={!!image} onOpenChange={v=>{if(!v)setImage(null)}}><DialogContent className="!max-w-4xl max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}><DialogTitle>{image?.label||'Bilde'}</DialogTitle>{image&&<img className="chat-image-expanded" src={image.url} alt={image.label}/>}</DialogContent></Dialog></>;
}
