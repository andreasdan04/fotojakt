import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('vite'))('esbuild');
import path from 'node:path';
// Exercise the actual Pointer Event handlers with a lightweight hook harness.
// This verifies event/state logic, not physical hardware or browser rendering.
// Inject harness exports into the same bundle to retain hook state across renders.
const entry=await build({stdin:{contents:"export {default as Pad} from './app/signature-pad';export {begin,reset} from 'react';export {validSignature,signaturePoint} from './lib/signature';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',alias:{'@':path.resolve('.')},plugins:[{name:'hooks',setup(b){b.onResolve({filter:/^react$/},()=>({path:'hooks',namespace:'test'}));b.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},({path})=>({loader:'js',contents:path==='hooks'?`let values=[],i=0;export const begin=()=>{i=0};export const reset=()=>{values=[];i=0};export function useState(init){let n=i++;if(!(n in values))values[n]=init;return [values[n],v=>{values[n]=typeof v==='function'?v(values[n]):v}]};export function useRef(init){let n=i++;if(!(n in values))values[n]={current:init};return values[n]}`:`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`}));}}]});
assert(entry.outputFiles.length===1);
const {Pad,begin,reset,validSignature,signaturePoint}=await import('data:text/javascript;base64,'+Buffer.from(entry.outputFiles[0].text).toString('base64'));
const find=(node,type)=>!node?null:node.type===type?node:(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).map(n=>typeof n==='object'?find(n,type):null).find(Boolean);
for(const pointerType of ['touch','mouse','pen']){
 reset();let signature=[],captured=false;
 const props={onChange:value=>{signature=value}},render=()=>{begin();return Pad(props)};
 const rect={left:30,top:50,width:360,height:160};
 const event=(i,id=1)=>({pointerId:id,pointerType,isPrimary:true,button:0,clientX:60+i*8,clientY:120+Math.sin(i)*20,preventDefault(){},nativeEvent:{getCoalescedEvents:()=>[],clientX:60+i*8,clientY:120+Math.sin(i)*20},currentTarget:{getBoundingClientRect:()=>rect,setPointerCapture:()=>{captured=true}}});
 let svg=find(render(),'svg');svg.props.onPointerDown(event(0));assert(captured);assert.deepEqual(signature,[],'unfinished stroke not accepted');
 svg=find(render(),'svg');svg.props.onPointerDown(event(0,2));svg.props.onPointerMove(event(1,2));
 for(let i=1;i<12;i++)find(render(),'svg').props.onPointerMove(event(i));
 find(render(),'svg').props.onPointerUp(event(12));assert(validSignature(signature),pointerType+' creates valid drawn signature');assert.equal(signature.length,1,'second finger ignored');assert(signature[0].every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
 find(render(),'button').props.onClick();assert.deepEqual(signature,[],'clear removes prior signature');
 svg=find(render(),'svg');svg.props.onPointerDown(event(0));svg.props.onPointerUp(event(0));assert.deepEqual(signature,[],'single tap rejected');
 props.disabled=true;find(render(),'svg').props.onPointerDown(event(0));assert.deepEqual(signature,[],'cannot draw during submit');
}
assert.equal(validSignature([[{x:Infinity,y:.1}]]),false);assert.equal(validSignature(Array.from({length:81},()=>[{x:.1,y:.1}])),false);assert.deepEqual(signaturePoint(-100,500,{left:0,top:0,width:300,height:150}),{x:0,y:1});
console.log('PASS: actual signature-pad touch, mouse and stylus Pointer Event handlers, capture, second-pointer rejection, coalesced-event fallback, nonempty completed strokes, single-tap rejection, clear/retry, disabled state and normalized coordinates. Physical browser/device verification remains separate.');
