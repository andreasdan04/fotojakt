'use client';
import {useEffect,useRef,useState} from 'react';
import {signaturePoint,validSignature,type SignatureData} from '@/lib/signature';
export function SignaturePreview({signature}:{signature:SignatureData}){
 return <svg viewBox="0 0 900 300" role="img" aria-label="Håndskrevet underskrift" className="signature-preview">{signature.map((stroke,i)=><polyline key={i} points={stroke.map(p=>`${p.x*900},${p.y*300}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>;
}
export default function SignaturePad({onChange,disabled=false}:{onChange:(value:SignatureData)=>void;disabled?:boolean}){
 const [strokes,setStrokes]=useState<SignatureData>([]),[drawing,setDrawing]=useState(false),active=useRef<number|null>(null),data=useRef<SignatureData>([]);
 const surface=useRef<HTMLDivElement>(null),pointerEvents=useRef(true);
 useEffect(()=>{
  pointerEvents.current=typeof window.PointerEvent!=='undefined';
  const field=surface.current;if(!field)return;
  // Delegated touch listeners may be passive. Cancel gestures on this HTML
  // surface only; the declaration and the rest of the page still scroll.
  const stopGesture=(event:TouchEvent)=>{if(event.cancelable)event.preventDefault()};
  const options={passive:false,capture:true};
  field.addEventListener('touchstart',stopGesture,options);
  field.addEventListener('touchmove',stopGesture,options);
  return()=>{field.removeEventListener('touchstart',stopGesture,options);field.removeEventListener('touchmove',stopGesture,options)};
 },[]);
 function update(){const next=data.current.map(s=>s.map(p=>({...p})));setStrokes(next);onChange(active.current===null&&validSignature(next)?next:[]);}
 function start(id:number,x:number,y:number){if(disabled||active.current!==null||data.current.length>=80||data.current.reduce((n,s)=>n+s.length,0)>=6000)return false;active.current=id;data.current.push([signaturePoint(x,y,surface.current!.getBoundingClientRect())]);setDrawing(true);update();return true;}
 function move(id:number,x:number,y:number){if(active.current!==id||disabled||data.current.reduce((n,s)=>n+s.length,0)>=6000)return;data.current.at(-1)!.push(signaturePoint(x,y,surface.current!.getBoundingClientRect()));update();}
 function finish(id:number,cancelled=false){if(active.current!==id)return;if(cancelled)data.current.pop();active.current=null;setDrawing(false);update();}
 return <div className="signature-field"><p id="signature-help">Tegn din faktiske underskrift i feltet. Du kan rulle siden utenfor feltet.</p><div ref={surface} className="signature-pad" style={{touchAction:'none'}} role="img" aria-label="Signaturfelt – tegn underskriften din" aria-describedby="signature-help"
  onPointerDown={e=>{if(!pointerEvents.current||!e.isPrimary||e.button!==0)return;e.preventDefault();if(start(e.pointerId,e.clientX,e.clientY))e.currentTarget.setPointerCapture(e.pointerId)}}
  onPointerMove={e=>{if(active.current!==e.pointerId)return;e.preventDefault();const coalesced=e.nativeEvent.getCoalescedEvents?.();for(const p of coalesced?.length?coalesced:[e.nativeEvent])move(e.pointerId,p.clientX,p.clientY)}}
  onPointerUp={e=>finish(e.pointerId)} onPointerCancel={e=>finish(e.pointerId,true)} onLostPointerCapture={e=>finish(e.pointerId,true)}
  onTouchStart={e=>{if(pointerEvents.current||active.current!==null)return;const p=e.changedTouches[0];if(p)start(p.identifier,p.clientX,p.clientY)}}
  onTouchMove={e=>{if(pointerEvents.current)return;for(const p of Array.from(e.changedTouches))move(p.identifier,p.clientX,p.clientY)}}
  onTouchEnd={e=>{if(pointerEvents.current)return;for(const p of Array.from(e.changedTouches))finish(p.identifier)}}
  onTouchCancel={e=>{if(pointerEvents.current)return;for(const p of Array.from(e.changedTouches))finish(p.identifier,true)}}>
  <svg viewBox="0 0 900 300" preserveAspectRatio="none" aria-hidden="true">{strokes.map((stroke,i)=><polyline key={i} points={stroke.map(p=>`${p.x*900},${p.y*300}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
 </div><div className="actions"><button type="button" className="button" disabled={disabled||drawing||!strokes.length} onClick={()=>{data.current=[];active.current=null;setStrokes([]);onChange([]);}}>Tøm signaturen</button><small role="status">{drawing?'Tegner …':validSignature(strokes)?'Signaturen er klar.':'Underskriften må tegnes før du kan signere.'}</small></div></div>;
}
