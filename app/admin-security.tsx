'use client';
import {useEffect,useState} from 'react';
export default function AdminSecurity({act}:any){
 const [health,setHealth]=useState<any>(null),[error,setError]=useState('');
 async function load(){try{const r=await fetch('/api/privacy/maintenance',{cache:'no-store'}),j:any=await r.json();if(!r.ok)throw Error(j.error);setHealth(j);setError('')}catch(e:any){setError(e.message)}}
 useEffect(()=>{load()},[]);
 let last='Oppryddingsjobben har ennå ikke kjørt.';try{if(health?.lastRun)last='Siste opprydding: '+new Date(JSON.parse(health.lastRun).created).toLocaleString('nb-NO')}catch{}
 return <section className="panel"><h2>Drift og personvern</h2><p>Følg opprydding, lagring og tilgang. Passordoppsettet er fjernet fra adminmenyen; eksisterende innloggingsbeskyttelse er beholdt.</p>{error&&<p className="error" role="alert">{error}</p>}{health&&<p role="status">{last} · Filer i slettekø: {health.queuedFiles}. Bildekontroller som må prøves igjen: {health.metadataRetries}. {health.lastFileFailure&&'Filsletting har feilet; kontroller lagringstilgangen.'}</p>}<button className="button" onClick={load}>Oppdater driftsstatus</button><h3>Sjekkliste</h3><ul><li>Vurder og begrens tilganger regelmessig. Hver administrator må godkjenne taushetserklæringen.</li><li>AI for brukerinnhold er pauset til avtaler, datainnstillinger og risikovurdering er avklart.</li><li>Statistikk: 90 dager. Jaktbilder: 730 dager. Chat: 365 dager.</li><li>Kontroller faktisk planlagt opprydding, sikkerhetskopier og sletting etter gjenoppretting.</li></ul><p className="muted">Kontakt: anddan2004@icloud.com. Tekniske avtale- og MFA-oppgaver må fortsatt fullføres.</p></section>
}
