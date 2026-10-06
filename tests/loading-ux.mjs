import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const localRequire=id=>{
  if(id==='@/components/ui/skeleton')return {Skeleton:props=>React.createElement('div',{'data-slot':'skeleton',...props})};
  if(id==='@/components/ui/checkbox')return {Checkbox:({checked,disabled})=>React.createElement('input',{type:'checkbox',checked,disabled,readOnly:true})};
  if(id==='@/lib/push-events')return {dailyReminders:[]};
  if(id.startsWith('@/'))return load(id.replace('@/','')+'.ts');
  if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id)+'.tsx');
  return require(id);
 };
 vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{setTimeout,clearTimeout})(localRequire,module,module.exports);
 cache.set(file,module.exports);return module.exports;
}
const {readPushDevice}=load('lib/push-client-status.ts');
let prompts=0;
const subscription={endpoint:'test',toJSON:()=>({endpoint:'test'})};
const device=(permission,sub=subscription)=>({Notification:{permission,requestPermission:()=>{prompts++;throw Error('Must be opt-in')}},PushManager:{},navigator:{serviceWorker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>sub}})}}});
assert.equal((await readPushDevice({})).supported,false);
assert.equal((await readPushDevice(device('granted'))).registered,true);
assert.equal((await readPushDevice(device('granted',null))).registered,false);
assert.equal((await readPushDevice(device('denied'))).registered,false);
assert.equal((await readPushDevice(device('default'))).permission,'default');
const failing=device('granted');failing.navigator.serviceWorker.getRegistration=async()=>{throw Error('offline')};
await assert.rejects(()=>readPushDevice(failing),/offline/);
assert.equal(prompts,0,'passive checks never ask permission');
const {AppSettings}=load('app/app-experience.tsx');
const app={pushChecked:true,pushChecking:false,pushSupported:true,config:{notificationsEnabled:true,configured:true,schedulerOnline:true,preferences:{}},installed:true,permission:'granted',registered:true,busy:false};
const html=extra=>renderToStaticMarkup(React.createElement(AppSettings,{app:{...app,...extra},notificationsOnly:true}));
let result=html({pushChecked:false,config:null});assert.match(result,/Sjekker varslingsstatus/);assert.match(result,/data-slot="skeleton"/);assert.doesNotMatch(result,/Slå på pushvarsler|Tillat pushvarsler/);
result=html({});assert.match(result,/Varsler er på for denne enheten/);assert.doesNotMatch(result,/Slå på pushvarsler/);
for(const extra of [{permission:'denied',registered:false},{pushSupported:false,registered:false},{config:{...app.config,notificationsEnabled:false}},{config:null,statusError:'Kan ikke sjekke'}])assert.doesNotMatch(html(extra),/Slå på pushvarsler/);
assert.match(html({permission:'default',registered:false}),/Slå på pushvarsler/);
const {LoadingBlock}=load('app/loading-states.tsx');
for(const kind of ['hunt','profile','rows','photos','feed','stats','chat','settings']){const result=renderToStaticMarkup(React.createElement(LoadingBlock,{kind}));assert.match(result,/aria-busy="true"/);assert.match(result,/data-slot="skeleton"/)}
const hunt=fs.readFileSync('app/hunt.tsx','utf8');
assert.doesNotMatch(hunt,/requestPermission\(/,'hunt and camera never request permission');
assert.match(hunt,/refresh\(true\)/,'post-mutation refresh bypasses an old poll');
assert.match(hunt,/loadedSelection!==season/,'album switches do not flash old data');
console.log('PASS: passive push checks, optional/blocked/unsupported/offline settings, no activation flash, accessible skeletons and hunt/camera isolation.');
