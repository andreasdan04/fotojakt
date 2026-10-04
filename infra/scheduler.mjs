// Background timer. No user data, push keys, public port or database access.
// The only credential can invoke the Site's notification dispatcher.
console.log('PHOTO HUNT scheduler booting');
(async()=>{
 const endpoint=process.env.PH_TICK_URL;
 const secret=process.env.PH_TICK_SECRET;
 if(!endpoint||!secret)throw Error('Missing PHOTO HUNT scheduler configuration');
 let stopping=false;
 process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
 let failures=0,lastLog=0;
 while(!stopping){
  const started=Date.now();let delay=15000;
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'x-photo-hunt-scheduler-key':secret},redirect:'error',signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error(`Dispatcher HTTP ${response.status}`);
   const result=await response.json();failures=0;
   if(result.sent||result.failed||Date.now()-lastLog>60000){console.log(JSON.stringify({event:'heartbeat',sent:result.sent||0,failed:result.failed||0,at:new Date().toISOString()}));lastLog=Date.now()}
   delay=result.remaining>0?1000:Math.max(1000,15000-(Date.now()-started));
  }catch(error){failures++;delay=Math.min(60000,15000*failures);console.error(error.message)}
  if(!stopping)await new Promise(resolve=>setTimeout(resolve,delay));
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
