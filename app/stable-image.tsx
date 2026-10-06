'use client';
import {useEffect,useRef,useState,type ImgHTMLAttributes} from 'react';
import {Skeleton} from '@/components/ui/skeleton';
export default function StableImage({src,alt='',className='',...props}:ImgHTMLAttributes<HTMLImageElement>){
 const image=useRef<HTMLImageElement>(null),[loaded,setLoaded]=useState(''),[failed,setFailed]=useState('');
 const key=typeof src==='string'?src:'',ready=loaded===key,bad=failed===key;
 useEffect(()=>{if(image.current?.complete&&image.current.naturalWidth)setLoaded(key)},[key]);
 return <span className={'stable-image '+className} aria-busy={!ready&&!bad}>
 {!ready&&!bad&&<Skeleton className="stable-image-placeholder" aria-hidden="true"/>}
 {bad?<span className="stable-image-error" role="status">Bildet kunne ikke lastes. Åpne bildet på nytt for å prøve igjen.</span>:null}
 <img {...props} ref={image} src={src} alt={alt} style={{...props.style,opacity:ready?1:0}} onLoad={e=>{setLoaded(key);setFailed('');props.onLoad?.(e)}} onError={e=>{setFailed(key);props.onError?.(e)}}/>
 </span>;
}
