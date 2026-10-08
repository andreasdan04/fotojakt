import {fail} from './server';
// Parse container boundaries instead of searching arbitrary compressed pixel bytes.
// This strips metadata without a native decoder dependency in the Worker runtime.
export function stripImageMetadata(input:ArrayBuffer|Uint8Array,mime:string):Uint8Array{
 const b=input instanceof Uint8Array?input:new Uint8Array(input),parts:Uint8Array[]=[];
 const join=()=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){out.set(p,offset);offset+=p.length}return out};
 const bad=()=>fail('Bildet kunne ikke kontrolleres. Velg JPG, PNG eller WebP.');
 if(mime==='image/jpeg'){
  if(b[0]!==255||b[1]!==216)bad();parts.push(b.slice(0,2));let i=2,scan=false,frame=false;
  while(i<b.length){if(b[i]!==255)bad();const start=i;while(b[i]===255)i++;const marker=b[i++];
   if(marker===217){if(!frame||!scan)bad();parts.push(new Uint8Array([255,217]));return join()}
   if(marker===0||marker===216||marker===undefined)bad();if(marker>=208&&marker<=215||marker===1){parts.push(b.slice(start,i));continue;}
   if(i+2>b.length)bad();const size=(b[i]<<8)|b[i+1];if(size<2||i+size>b.length)bad();const end=i+size;
   if(marker>=192&&marker<=207&&![196,200,204].includes(marker))frame=true;
   // APP and COM may carry EXIF/GPS, XMP, comments and arbitrary identity data.
   if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(b.slice(start,end));
   i=end;if(marker===218){scan=true;const from=i;while(i<b.length){if(b[i]!==255){i++;continue;}let j=i+1;while(b[j]===255)j++;if(b[j]===0||b[j]>=208&&b[j]<=215){i=j+1;continue;}break;}parts.push(b.slice(from,i));}
  }bad();
 }
 if(mime==='image/png'){
  if(b.length<33||![137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))bad();parts.push(b.slice(0,8));let i=8,header=false,pixels=false;
  while(i+12<=b.length){const n=new DataView(b.buffer,b.byteOffset+i,4).getUint32(0),end=i+12+n;if(end>b.length)bad();const type=String.fromCharCode(...b.slice(i+4,i+8));
   if(!header){if(type!=='IHDR'||n!==13)bad();header=true;}
   if(type==='IDAT')pixels=true;
   if(['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB'].includes(type))parts.push(b.slice(i,end));
   else if(type[0]===type[0].toUpperCase())bad();
   i=end;if(type==='IEND'){if(n!==0||!pixels)bad();return join();}
  }bad();
 }
 if(mime==='image/webp'){
  const word=(i:number)=>String.fromCharCode(...b.slice(i,i+4));if(word(0)!=='RIFF'||word(8)!=='WEBP'||b.length<20)bad();parts.push(b.slice(0,12));let i=12,pixels=false;
  while(i+8<=b.length){const n=new DataView(b.buffer,b.byteOffset+i+4,4).getUint32(0,true),end=i+8+n+(n%2);if(end>b.length)bad();const type=word(i);if(['VP8 ','VP8L','ANMF'].includes(type))pixels=true;
   if(['VP8 ','VP8L','VP8X','ALPH','ANIM','ANMF'].includes(type)){const chunk=b.slice(i,end);if(type==='VP8X')chunk[8]&=~(32|8|4);parts.push(chunk);}else if(!['EXIF','XMP ','ICCP'].includes(type))bad();i=end;
  }if(i!==b.length||!pixels)bad();const out=join();new DataView(out.buffer).setUint32(4,out.length-8,true);return out;
 }
 return bad();
}
