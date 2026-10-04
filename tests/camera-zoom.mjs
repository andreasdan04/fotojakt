import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/camera-zoom.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {cameraCrop,clampCameraZoom,fitCameraFrame}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.equal(clampCameraZoom(.2),1);
assert.equal(clampCameraZoom(8),4);
assert.equal(clampCameraZoom(NaN),1);
assert.deepEqual(cameraCrop(1600,1200,1),{sx:0,sy:0,sw:1600,sh:1200});
assert.deepEqual(cameraCrop(1600,1200,2),{sx:400,sy:300,sw:800,sh:600});
assert.deepEqual(cameraCrop(1200,1600,4),{sx:450,sy:600,sw:300,sh:400});
assert.deepEqual(fitCameraFrame(390,550,1600,1200),{width:390,height:292.5});
assert.deepEqual(fitCameraFrame(700,250,1200,1600),{width:187.5,height:250});
for(const [w,h] of [[1600,1200],[1200,1600],[1920,1080]])for(const zoom of [1,1.5,2,4]){
 const crop=cameraCrop(w,h,zoom);
 assert.ok(Math.abs(crop.sw/crop.sh-w/h)<1e-10);
 assert.equal(crop.sx+crop.sw/2,w/2);
 assert.equal(crop.sy+crop.sh/2,h/2);
}
console.log('Camera zoom: limits, centred saved crop, and portrait/landscape preview fit passed.');
