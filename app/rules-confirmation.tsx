'use client';
import {useId,useState} from 'react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {RULES_DETAILS} from '@/lib/rules-content';
import {Zap} from 'lucide-react';
import {toast} from 'sonner';
export function DetailedRules({details=RULES_DETAILS}:any){return <div className="rules-details">{details.map((rule:any)=><section key={rule.title}><h3>{rule.title}</h3><p>{rule.text}</p></section>)}</div>}
export default function RulesStart({challenge,busy,act}:any){
 const [rules,setRules]=useState<any>(null),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[checked,setChecked]=useState(false),[expanded,setExpanded]=useState(false),[error,setError]=useState('');const detailId=useId();
 async function getRules(){const r=await fetch('/api/rules',{cache:'no-store'}),j:any=await r.json();if(!r.ok)throw Error(j.error||'Kunne ikke hente reglene.');return j}
 async function start(){setLoading(true);setError('');try{const current=await getRules();if(current.accepted)await act({action:'start-daily',id:challenge},'Klokken din har startet!');else{setChecked(false);setExpanded(false);setRules(current)}}catch(e:any){toast.error(e.message)}finally{setLoading(false)}}
 async function accept(){if(!checked||saving)return;setSaving(true);setError('');try{const r=await fetch('/api/rules',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rules_version:rules.version,accepted:true})}),j:any=await r.json();if(!r.ok){if(r.status===409){setRules(await getRules());setChecked(false)}throw Error(j.error||'Kunne ikke lagre regelaksept.')}if(await act({action:'start-daily',id:challenge},'Klokken din har startet!'))setRules(null)}catch(e:any){setError(e.message)}finally{setSaving(false)}}
 return <><button className="primary" disabled={busy||loading} onClick={start}>{loading?'Henter regler …':'Start og vis ordet'} <Zap size={20}/></button><Dialog open={!!rules} onOpenChange={open=>{if(!open&&!saving)setRules(null)}}><DialogContent className="rules-dialog" onInteractOutside={e=>saving&&e.preventDefault()} onEscapeKeyDown={e=>saving&&e.preventDefault()} showCloseButton={!saving}>
 <div><DialogTitle>📸 Før du starter</DialogTitle><DialogDescription>Kort forklart:</DialogDescription></div>
 <div className="rules-scroll"><ul className="rules-summary">{rules?.summary.map((text:string)=><li key={text}>{text}</li>)}</ul><button type="button" className="button rules-toggle" aria-expanded={expanded} aria-controls={detailId} onClick={()=>setExpanded(v=>!v)}>{expanded?'Skjul detaljer':'Les reglene i detalj'}</button>{expanded&&<div id={detailId}><DetailedRules details={rules?.details}/></div>}</div>
 <div className="rules-footer"><label className="rules-check"><input type="checkbox" checked={checked} disabled={saving} onChange={e=>setChecked(e.target.checked)}/><span>Jeg har lest og forstått reglene for Foto Jakt</span></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={!checked||busy||saving} onClick={accept}>{saving?'Lagrer og starter …':'Godta og start jakten'}</button></div>
 </DialogContent></Dialog></>;
}
