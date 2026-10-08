// Normalized vector strokes avoid storing arbitrary SVG or image uploads.
export type SignaturePoint={x:number;y:number};
export type SignatureData=SignaturePoint[][];
export function validSignature(value:unknown):value is SignatureData {
 if(!Array.isArray(value)||!value.length||value.length>80)return false;
 let points=0,distance=0;
 for(const stroke of value){
  if(!Array.isArray(stroke)||!stroke.length)return false;
  for(let i=0;i<stroke.length;i++){
   const p=stroke[i];if(!p||typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)return false;
   if(i)distance+=Math.hypot(p.x-stroke[i-1].x,p.y-stroke[i-1].y);
   if(++points>6000)return false;
  }
 }
 return points>=8&&distance>=0.12;
}
export function signaturePoint(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}):SignaturePoint{
 return {x:Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(clientY-rect.top)/rect.height))};
}
