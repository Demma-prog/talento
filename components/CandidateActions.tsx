"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Download, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
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
  return <a className="primary-button purple-button" href={`/api/candidates/${candidateId}/cv`} target="_blank" rel="noopener noreferrer"><Download size={16}/> Apri CV</a>;
}

type EditableCandidate = { first_name:string; last_name:string; birth_year:number|null; birth_place:string|null; declared_gender:string|null; email:string|null; phone:string|null; city:string|null; bio:string|null };

export function CandidateEditor({ candidateId, candidate, startOpen=false }: { candidateId:string; candidate:EditableCandidate; startOpen?:boolean }) {
  const router=useRouter(); const [open,setOpen]=useState(startOpen); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
  const [form,setForm]=useState({...candidate,birth_year:candidate.birth_year?.toString()??""});
  const field=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));
  async function submit(event:FormEvent){event.preventDefault();setSaving(true);setError("");try{const {data}=await createClient().auth.getSession();if(!data.session)throw new Error("Sessione scaduta");const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;const response=await fetch(`${api}/candidates/${candidateId}`,{method:"PATCH",headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({...form,birth_year:form.birth_year?Number(form.birth_year):null,declared_gender:form.declared_gender||null,mark_verified:true})});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail??"Modifica non salvata");}setOpen(false);router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Modifica non salvata");}finally{setSaving(false)}}
  if(!open)return <button className="secondary-button" onClick={()=>setOpen(true)}><Pencil size={16}/> Modifica dati</button>;
  return <section className="candidate-editor panel"><div className="panel-head"><div><p className="eyebrow">Correzione manuale</p><h3>Modifica i dati del candidato</h3></div><button className="round-add" type="button" onClick={()=>setOpen(false)} aria-label="Chiudi"><X size={17}/></button></div><form onSubmit={submit}><div className="editor-grid"><label>Nome<input value={form.first_name} onChange={e=>field("first_name",e.target.value)} required/></label><label>Cognome<input value={form.last_name} onChange={e=>field("last_name",e.target.value)} required/></label><label>Anno di nascita<input type="number" min="1900" max={new Date().getFullYear()} value={form.birth_year} onChange={e=>field("birth_year",e.target.value)}/></label><label>Luogo di nascita<input value={form.birth_place??""} onChange={e=>field("birth_place",e.target.value)}/></label><label>Sesso dichiarato<select value={form.declared_gender??""} onChange={e=>field("declared_gender",e.target.value)}><option value="">Non dichiarato</option><option value="female">Donna</option><option value="male">Uomo</option><option value="other">Altro</option></select></label><label>Città<input value={form.city??""} onChange={e=>field("city",e.target.value)}/></label><label>Email<input type="email" value={form.email??""} onChange={e=>field("email",e.target.value)}/></label><label>Telefono<input value={form.phone??""} onChange={e=>field("phone",e.target.value)}/></label><label className="editor-wide">Bio<textarea value={form.bio??""} maxLength={2000} onChange={e=>field("bio",e.target.value)}/></label></div>{error&&<p className="form-error">{error}</p>}<div className="editor-actions"><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Annulla</button><button className="primary-button purple-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} Salva e verifica</button></div></form></section>;
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
