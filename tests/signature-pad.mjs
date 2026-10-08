import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
import path from 'node:path';
import {readFile} from 'node:fs/promises';
// Exercise the actual Pointer Event handlers with a lightweight hook harness.
// This verifies event/state logic, not physical hardware or browser rendering.
// Inject harness exports into the same bundle to retain hook state across renders.
const entry=await build({stdin:{contents:"export {default as Pad} from './app/signature-pad';export {begin,reset,flush} from 'react';export {validSignature,signaturePoint} from './lib/signature';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',alias:{'@':path.resolve('.')},plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'test'}));b.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path})=>({loader:'js',contents:path==='hooks'?`let values=[],i=0,effects=[],cleanups=[];export const begin=()=>{i=0};export const reset=()=>{for(const f of cleanups)f?.();values=[];i=0;effects=[];cleanups=[]};export const flush=()=>{for(const f of effects.splice(0))cleanups.push(f())};export function useEffect(fn){const n=i++;if(!(n in values)){values[n]=true;effects.push(fn)}};export function useState(init){let n=i++;if(!(n in values))values[n]=init;return [values[n],v=>{values[n]=typeof v==='function'?v(values[n]):v}]};export function useRef(init){let n=i++;if(!(n in values))values[n]={current:init};return values[n]}`:`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`}));}}]});
assert(entry.outputFiles.length===1);
const {Pad,begin,reset,flush,validSignature,signaturePoint}=await import('data:text/javascript;base64,'+Buffer.from(entry.outputFiles[0].text).toString('base64'));
const find=(node,type)=>!node?null:node.type===type?node:(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).map(n=>typeof n==='object'?find(n,type):null).find(Boolean);
const surfaceNode=node=>node.type==='div'&&node.props.className==='signature-pad'?node:(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).map(n=>n&&typeof n==='object'?surfaceNode(n):null).find(Boolean);
function mount(pointerSupport=true){
 globalThis.window=pointerSupport?{PointerEvent:function(){}}:{};reset();
 let signature=[],captured=false;const listeners=new Map(),removed=[];
 const rect={left:30,top:50,width:260,height:180};
 const target={getBoundingClientRect:()=>rect,setPointerCapture:()=>{captured=true},addEventListener:(name,fn,options)=>{assert.equal(options.passive,false);assert.equal(options.capture,true);listeners.set(name,fn)},removeEventListener:(name,fn)=>{assert.equal(listeners.get(name),fn);listeners.delete(name);removed.push(name)}};
 const props={onChange:value=>{signature=value}};
 const render=()=>{begin();const node=Pad(props);surfaceNode(node).props.ref.current=target;flush();return node};
 const pad=()=>surfaceNode(render()).props;
 render();assert.equal(pad().style.touchAction,'none');assert.equal(find(render(),'svg').props['aria-hidden'],'true');
 for(const name of ['touchstart','touchmove']){let prevented=0;listeners.get(name)({cancelable:true,preventDefault:()=>prevented++});assert.equal(prevented,1,name+' actively blocks page gestures');listeners.get(name)({cancelable:false,preventDefault(){throw Error('uncancellable event')}});}
 return {pad,render,props,target,listeners,removed,get signature(){return signature},get captured(){return captured}};
}
for(const pointerType of ['touch','mouse','pen']){
 const m=mount();
 const event=(i,id=1)=>({pointerId:id,pointerType,isPrimary:true,button:0,clientX:60+i*8,clientY:120+Math.sin(i)*20,preventDefault(){},nativeEvent:{getCoalescedEvents:()=>[],clientX:60+i*8,clientY:120+Math.sin(i)*20},currentTarget:m.target});
 m.pad().onPointerDown(event(0));assert(m.captured);assert.deepEqual(m.signature,[],'unfinished stroke not accepted');
 m.pad().onPointerDown(event(0,2));m.pad().onPointerMove(event(1,2));
 for(let i=1;i<12;i++)m.pad().onPointerMove(event(i));
 m.pad().onPointerUp(event(12));assert(validSignature(m.signature),pointerType+' creates valid drawn signature');assert.equal(m.signature.length,1,'second finger ignored');assert(m.signature[0].every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
 const complete=structuredClone(m.signature);
 m.pad().onPointerDown(event(0));for(let i=1;i<12;i++)m.pad().onPointerMove(event(i));m.pad().onPointerCancel(event(12));assert.deepEqual(m.signature,complete,'cancel drops only unfinished stroke');
 m.pad().onPointerDown(event(0));m.pad().onLostPointerCapture(event(1));assert.deepEqual(m.signature,complete,'unexpected lost capture is not a completed signature');
 find(m.render(),'button').props.onClick();assert.deepEqual(m.signature,[],'clear removes prior signature');
 m.pad().onPointerDown(event(0));m.pad().onPointerUp(event(0));assert.deepEqual(m.signature,[],'single tap rejected');
 m.props.disabled=true;m.pad().onPointerDown(event(0));assert.deepEqual(m.signature,[],'cannot draw during submit');
 reset();assert.equal(m.listeners.size,0,'native listeners removed on unmount');assert.deepEqual(m.removed,['touchstart','touchmove']);
}
const legacy=mount(false),touch=(i,id=42)=>({changedTouches:[{identifier:id,clientX:60+i*8,clientY:120+Math.sin(i)*20}]});
legacy.pad().onTouchStart(touch(0));legacy.pad().onTouchStart(touch(0,43));for(let i=1;i<12;i++)legacy.pad().onTouchMove(touch(i));legacy.pad().onTouchEnd(touch(12,43));assert.deepEqual(legacy.signature,[],'second finger cannot end first finger');legacy.pad().onTouchEnd(touch(12));assert(validSignature(legacy.signature),'Touch Event fallback draws without Pointer Events');
legacy.pad().onTouchStart(touch(0));for(let i=1;i<12;i++)legacy.pad().onTouchMove(touch(i));legacy.pad().onTouchCancel(touch(12));assert.equal(legacy.signature.length,1,'legacy cancelled stroke discarded');reset();delete globalThis.window;
const css=await readFile('app/globals.css','utf8'),layout=await readFile('app/layout.tsx','utf8');
assert(css.includes('.admin-onboarding form{display:grid;grid-template-columns:minmax(0,1fr)'));
assert(css.includes('.signature-pad>svg{display:block;width:100%;height:100%;pointer-events:none}'));
assert(!/\.signature-pad\{[^}]*aspect-ratio/.test(css),'signature surface height does not transfer a minimum intrinsic width');
assert(!/maximumScale|userScalable/.test(layout),'ordinary page zoom remains available');
assert.equal(validSignature([[{x:Infinity,y:.1}]]),false);assert.equal(validSignature(Array.from({length:81},()=>[{x:.1,y:.1}])),false);assert.deepEqual(signaturePoint(-100,500,{left:0,top:0,width:300,height:150}),{x:0,y:1});
console.log('PASS: real signature component Pointer/Touch handlers, mouse/stylus, nonpassive local gesture guards and cleanup, capture, second finger, cancelled strokes, clear/retry, disabled state, normalized coordinates and mobile width CSS. Physical browser/device verification remains separate.');
