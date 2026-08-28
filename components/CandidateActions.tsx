"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const statuses = [
  ["never_contacted", "Mai contattato"], ["to_contact", "Da contattare"],
  ["contacted", "Contattato"], ["interview_scheduled", "Colloquio programmato"],
  ["accepted", "Accettato"], ["rejected_after_contact", "Rifiutato dopo il contatto"],
  ["rejected_directly", "Rifiutato direttamente"], ["unavailable", "Non disponibile"],
  ["reconsider", "Da rivalutare"],
] as const;

export function CandidatePhoto({ candidateId, initials, large=false }: { candidateId:string; initials:string; large?:boolean }) {
  const [url,setUrl] = useState<string|null>(null);
  useEffect(()=>{
    let objectUrl:string|null=null; let active=true;
    void createClient().auth.getSession().then(async({data})=>{
      if(!data.session)return;
      const response=await fetch(`${process.env.NEXT_PUBLIC_API_URL}/candidates/${candidateId}/photo`,{headers:{Authorization:`Bearer ${data.session.access_token}`}});
      if(!response.ok)return;
      objectUrl=URL.createObjectURL(await response.blob());
      if(active)setUrl(objectUrl);
    }).catch(()=>undefined);
    return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
  },[candidateId]);
  return <span className={large?"large-avatar candidate-photo":"candidate-photo candidate-photo-small"}>{url?<img src={url} alt=""/>:initials}</span>;
}

export function CvButton({ candidateId }: { candidateId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function openCv() {
    setLoading(true); setError("");
    const preview = window.open("", "_blank");
    try {
      const { data } = await createClient().auth.getSession();
      if (!data.session) throw new Error("Sessione scaduta");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/candidates/${candidateId}/cv`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
      if (!response.ok) { const body = await response.json(); throw new Error(body.detail ?? "CV non disponibile"); }
      const url = URL.createObjectURL(await response.blob());
      if (preview) preview.location.href = url; else window.location.href = url;
      window.setTimeout(()=>URL.revokeObjectURL(url), 60_000);
    } catch (cause) { if (preview) preview.close(); setError(cause instanceof Error ? cause.message : "CV non disponibile"); }
    finally { setLoading(false); }
  }
  return <div className="cv-action"><button className="primary-button purple-button" onClick={openCv} disabled={loading}>{loading?<LoaderCircle className="spin" size={16}/>:<Download size={16}/>} Apri CV</button>{error&&<small>{error}</small>}</div>;
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
