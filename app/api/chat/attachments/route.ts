import {stripImageMetadata} from '@/lib/image-privacy';
import {member,origin,all,one,run,bucket,wrap,json,fail,str} from '@/lib/server';
import {requireChatRoom} from '@/lib/chat-access';
import {limit} from '@/lib/auth';
export const dynamic='force-dynamic';
export const POST=wrap(async(req:Request)=>{
 origin(req);const m=await member();await limit(req,'chat-upload:'+m.id,60);if(Number(req.headers.get('content-length')||0)>11000000)fail('Filen må være under 10 MB.');
 const form=await req.formData(),room=str(form.get('room'),100),id=str(form.get('id'),100),file=form.get('file');await requireChatRoom(room,m.id);
 if(!/^[a-f0-9-]{36}$/i.test(id)||!(file instanceof File)||!file.size||file.size>10000000)fail('Velg en fil under 10 MB.');
 const name=file.name.replace(/[\u0000-\u001f\\/]/g,'_').slice(0,120)||'Vedlegg',extension=name.split('.').at(-1)?.toLowerCase(),raw=new Uint8Array(await file.arrayBuffer());let bytes:Uint8Array=raw;let mime='';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
 else if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)mime='image/png';
 else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')mime='image/webp';
 else if(String.fromCharCode(...bytes.slice(0,6)).startsWith('GIF8'))mime='image/gif';
 else if(extension==='pdf'&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-')mime='application/pdf';
 else if(['txt','csv'].includes(extension||'')&&!bytes.slice(0,8192).includes(0)){try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);mime=extension==='csv'?'text/csv':'text/plain'}catch{}}
 else if(['docx','xlsx','pptx','zip'].includes(extension||'')&&bytes[0]===80&&bytes[1]===75)mime='application/octet-stream';
 if(!['image/jpeg','image/png','image/webp','text/plain','text/csv'].includes(mime))fail('Støtter JPG, PNG, WebP, TXT og CSV. Andre filer er satt på pause inntil trygg behandling er klar.');
 if(mime.startsWith('image/'))bytes=stripImageMetadata(bytes,mime);
 if(mime.startsWith('image/')&&file.size>5000000)fail('Bilder må være under 5 MB.');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))].map(b=>b.toString(16).padStart(2,'0')).join(''),existing=await one('SELECT * FROM chat_attachments WHERE id=?',id);
 if(existing){if(existing.user!==m.id||existing.room!==room||existing.digest!==digest)fail('Vedlegget er allerede brukt.',409);if(await bucket().head(existing.key))return json({attachment:{id,name:existing.name,mime:existing.mime,size:existing.size}});}
 if((await one('SELECT COUNT(*) n FROM chat_attachments WHERE user=? AND message IS NULL',m.id)).n>=12)fail('Du har flere usendte vedlegg. Send eller fjern dem først.');
 const key='chat/'+id;await run('INSERT OR IGNORE INTO chat_attachments(id,room,user,key,name,mime,size,digest,created) VALUES(?,?,?,?,?,?,?,?,?)',id,room,m.id,key,name,mime,bytes.length,digest,Date.now());const reserved=await one('SELECT user,room,digest FROM chat_attachments WHERE id=?',id);if(reserved?.user!==m.id||reserved?.room!==room||reserved?.digest!==digest)fail('Vedlegget er allerede brukt.',409);await bucket().put(key,bytes,{httpMetadata:{contentType:mime}});
 return json({attachment:{id,name,mime,size:bytes.length}});
});
