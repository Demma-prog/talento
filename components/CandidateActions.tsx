"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ExternalLink, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const statuses = [
  ["never_contacted", "Mai contattato"], ["to_contact", "Da contattare"],
  ["contacted", "Contattato"], ["interview_scheduled", "Colloquio programmato"],
  ["accepted", "Accettato"], ["rejected_after_contact", "Rifiutato dopo il contatto"],
  ["rejected_directly", "Rifiutato direttamente"], ["unavailable", "Non disponibile"],
  ["reconsider", "Da rivalutare"],
] as const;

export function CandidatePhoto({ candidateId, initials, large=false }: { candidateId:string; initials:string; large?:boolean }) {
  const [failed,setFailed]=useState(false);
  return <span className={large?"large-avatar candidate-photo":"candidate-photo candidate-photo-small"}>{failed?initials:<img src={`/api/candidates/${candidateId}/photo`} alt="" loading={large?"eager":"lazy"} onError={()=>setFailed(true)}/>}</span>;
}

export function CvButton({ candidateId }: { candidateId: string }) {
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function open(){setLoading(true);setError("");const tab=window.open("","_blank");if(tab){tab.opener=null;tab.document.title="Caricamento curriculum…";tab.document.body.textContent="Caricamento curriculum…"}try{const response=await fetch(`/api/candidates/${candidateId}/cv`,{cache:"no-store"});if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.detail??"Curriculum non disponibile")}const blob=await response.blob();if(!blob.size)throw new Error("Il curriculum ricevuto è vuoto");const url=URL.createObjectURL(blob);const disposition=response.headers.get("content-disposition")??"";const isPdf=(response.headers.get("content-type")??"").includes("pdf");if(isPdf){if(!tab)throw new Error("Il browser ha bloccato l’apertura del curriculum");tab.location.href=url;window.setTimeout(()=>URL.revokeObjectURL(url),60000)}else{tab?.close();const link=document.createElement("a");link.href=url;link.download=decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1]??"curriculum");link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}}catch(cause){tab?.close();setError(cause instanceof Error?cause.message:"Curriculum non disponibile")}finally{setLoading(false)}}
  return <div className="cv-action"><button type="button" className="primary-button purple-button" onClick={open} disabled={loading}>{loading?<LoaderCircle className="spin" size={16}/>:<ExternalLink size={16}/>} Apri CV</button>{error&&<small>{error}</small>}</div>;
}

type EditableCandidate = { first_name:string; last_name:string; birth_year:number|null; birth_place:string|null; declared_gender:string|null; email:string|null; phone:string|null; city:string|null; bio:string|null };

export function CandidateEditor({ candidateId, candidate, startOpen=false }: { candidateId:string; candidate:EditableCandidate; startOpen?:boolean }) {
  const router=useRouter(); const [open,setOpen]=useState(startOpen); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [form,setForm]=useState({...candidate,birth_year:candidate.birth_year?.toString()??""});
  const field=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));
  async function submit(event:FormEvent){event.preventDefault();setSaving(true);setError("");try{const response=await fetch(`/api/candidates/${candidateId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,birth_year:form.birth_year?Number(form.birth_year):null,declared_gender:form.declared_gender||null})});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail??"Modifica non salvata");}setOpen(false);router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Modifica non salvata");}finally{setSaving(false)}}
  if(!open)return <button className="secondary-button" onClick={()=>setOpen(true)}><Pencil size={16}/> Modifica dati</button>;
  return <section className="candidate-editor panel"><div className="panel-head"><div><p className="eyebrow">Correzione manuale</p><h3>Modifica i dati del candidato</h3></div><button className="round-add" type="button" onClick={()=>setOpen(false)} aria-label="Chiudi"><X size={17}/></button></div><form onSubmit={submit}><div className="editor-grid"><label>Nome<input value={form.first_name} onChange={e=>field("first_name",e.target.value)} required/></label><label>Cognome<input value={form.last_name} onChange={e=>field("last_name",e.target.value)} required/></label><label>Anno di nascita<input type="number" min="1900" max={new Date().getFullYear()} value={form.birth_year} onChange={e=>field("birth_year",e.target.value)}/></label><label>Luogo di nascita<input value={form.birth_place??""} onChange={e=>field("birth_place",e.target.value)}/></label><label>Sesso<select value={form.declared_gender??""} onChange={e=>field("declared_gender",e.target.value)}><option value="">Da compilare</option><option value="female">Donna</option><option value="male">Uomo</option><option value="other">Altro</option><option value="unspecified">Non indicato</option></select></label><label>Città<input value={form.city??""} onChange={e=>field("city",e.target.value)}/></label><label>Email<input type="email" value={form.email??""} onChange={e=>field("email",e.target.value)}/></label><label>Telefono<input value={form.phone??""} onChange={e=>field("phone",e.target.value)}/></label><label className="editor-wide">Bio<textarea value={form.bio??""} maxLength={2000} onChange={e=>field("bio",e.target.value)}/></label></div>{error&&<p className="form-error">{error}</p>}<div className="editor-actions"><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Annulla</button><button className="primary-button purple-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Salva modifiche</button></div></form></section>;
}

export function QuickGenderButtons({candidateId}:{candidateId:string}){
  const router=useRouter();const [saving,setSaving]=useState<string|null>(null);const [error,setError]=useState("");
  const choices=[["female","Donna"],["male","Uomo"],["other","Altro"],["unspecified","Non indicato"]] as const;
  async function choose(value:string){setSaving(value);setError("");try{const response=await fetch(`/api/candidates/${candidateId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({declared_gender:value})});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail??"Dato non salvato")}router.refresh()}catch(cause){setError(cause instanceof Error?cause.message:"Dato non salvato")}finally{setSaving(null)}}
  return <div className="quick-gender" aria-label="Inserisci sesso manualmente">{choices.map(([value,label])=><button type="button" key={value} disabled={saving!==null} onClick={()=>choose(value)}>{saving===value?<LoaderCircle className="spin" size={12}/>:null}{label}</button>)}{error&&<small>{error}</small>}</div>;
}

export function StatusControl({ candidateId, value }: { candidateId: string; value: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  async function change(next: string) {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("candidates").update({ status: next }).eq("id", candidateId);
    setSaving(false);
    if (!error) router.refresh();
  }
  return <div className="status-select status-select-native"><span className="status-dot-big"/><select value={value} onChange={event=>change(event.target.value)} disabled={saving}>{statuses.map(([key,label])=><option value={key} key={key}>{label}</option>)}</select>{saving&&<LoaderCircle className="spin" size={15}/>}</div>;
}

const jobCategories=[["accounting","Contabilità"],["logistics","Logistica"],["marketing","Marketing"],["cashier","Cassiere/a"],["sales","Commesso/a"],["warehouse","Magazzino"],["office","Ufficio"],["other","Altro"]] as const;
export function CandidateClassification({candidateId,category,protectedCategory}:{candidateId:string;category:string|null;protectedCategory:boolean}){
  const router=useRouter();const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  async function update(values:{job_category?:string;protected_category?:boolean}){setSaving(true);setError("");try{const response=await fetch(`/api/candidates/${candidateId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(values)});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail??"Classificazione non salvata")}router.refresh()}catch(cause){setError(cause instanceof Error?cause.message:"Classificazione non salvata")}finally{setSaving(false)}}
  return <div className="classification-control"><label>Categoria principale<select defaultValue={category??"other"} disabled={saving} onChange={event=>update({job_category:event.target.value})}>{jobCategories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="protected-toggle"><input type="checkbox" defaultChecked={protectedCategory} disabled={saving} onChange={event=>update({protected_category:event.target.checked})}/><span>Appartiene alle categorie protette</span></label>{error&&<small>{error}</small>}</div>
}

export function NoteForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true); setError("");
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) { setError("Sessione scaduta"); setSaving(false); return; }
    const result = await supabase.from("candidate_notes").insert({ candidate_id: candidateId, author_id: data.user.id, body: body.trim() });
    setSaving(false);
    if (result.error) { setError("Nota non salvata"); return; }
    setBody(""); router.refresh();
  }
  return <form onSubmit={submit}><textarea value={body} onChange={event=>setBody(event.target.value)} maxLength={4000} placeholder="Aggiungi un appunto utile e pertinente alla selezione..."/><div className="note-footer"><small>{error||"Le note vengono registrate con autore e data."}</small><button className="primary-button purple-button" disabled={saving||!body.trim()}>{saving?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Salva nota</button></div></form>;
}

export function DeleteCandidateButton({candidateId,name}:{candidateId:string;name:string}){const router=useRouter();const [loading,setLoading]=useState(false);async function remove(){if(!window.confirm(`Eliminare definitivamente la scheda di ${name}? L'email originale resterà in Gmail.`))return;setLoading(true);const {data}=await createClient().auth.getSession();if(!data.session){setLoading(false);return}const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;const response=await fetch(`${api}/candidates/${candidateId}`,{method:"DELETE",headers:{Authorization:`Bearer ${data.session.access_token}`}});if(response.ok)router.push("/candidati");else setLoading(false)}return <button className="danger-button" onClick={remove} disabled={loading}>{loading?<LoaderCircle className="spin" size={15}/>:<Trash2 size={15}/>} Elimina candidato</button>}

export function RetryPhotoButton({candidateId}:{candidateId:string}){const router=useRouter();const [loading,setLoading]=useState(false),[message,setMessage]=useState("");async function retry(){setLoading(true);setMessage("");const {data}=await createClient().auth.getSession();const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;const response=await fetch(`${api}/candidates/${candidateId}/photo/retry`,{method:"POST",headers:{Authorization:`Bearer ${data.session?.access_token??""}`}});const body=await response.json().catch(()=>({}));setLoading(false);if(response.ok){setMessage("Foto aggiornata");router.refresh()}else setMessage(body.detail??"Foto non recuperata")}return <div className="photo-retry"><button className="secondary-button" onClick={retry} disabled={loading}>{loading?<LoaderCircle className="spin" size={15}/>:<Camera size={15}/>} Recupera foto</button>{message&&<small>{message}</small>}</div>}
