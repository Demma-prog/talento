"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ConfirmMissingDataButton({candidateId}:{candidateId:string}){
  const router=useRouter();const [saving,setSaving]=useState(false);const [error,setError]=useState("");
  async function confirm(){setSaving(true);setError("");try{const response=await fetch(`/api/candidates/${candidateId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({missing_data_confirmed:true,mark_verified:true})});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.detail??"Conferma non salvata")}router.refresh()}catch(cause){setError(cause instanceof Error?cause.message:"Conferma non salvata")}finally{setSaving(false)}}
  return <div className="review-action"><button type="button" className="secondary-button compact-button" onClick={confirm} disabled={saving}>{saving?<LoaderCircle className="spin" size={13}/>:<Check size={13}/>} Conferma dati mancanti</button>{error&&<small>{error}</small>}</div>;
}

export function DeletePendingCvButton({rowId,filename}:{rowId:string;filename:string}){
  const router=useRouter();const [deleting,setDeleting]=useState(false);const [error,setError]=useState("");
  async function remove(){if(!window.confirm(`Rimuovere “${filename}” dalla coda? L'email originale resterà in Gmail.`))return;setDeleting(true);setError("");const result=await createClient().from("pending_cv_imports").delete().eq("id",rowId);if(result.error){setError("Impossibile eliminare il CV");setDeleting(false);return}router.refresh()}
  return <div className="review-action"><button type="button" className="icon-danger-button" aria-label={`Elimina ${filename} dalla coda`} title="Elimina dalla coda" onClick={remove} disabled={deleting}>{deleting?<LoaderCircle className="spin" size={15}/>:<Trash2 size={15}/>}</button>{error&&<small>{error}</small>}</div>;
}

type RecentCandidate={id:string;name:string;filename:string;updatedAt:string};
export function RecentProcessedCandidates({rows}:{rows:RecentCandidate[]}){
  const router=useRouter();const [selected,setSelected]=useState<string[]>([]);const [deleting,setDeleting]=useState(false);const [error,setError]=useState("");
  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(item=>item!==id):[...current,id])}
  async function remove(){if(!selected.length||!window.confirm(`Eliminare ${selected.length} candidat${selected.length===1?"o":"i"} dall'archivio? Le email originali resteranno in Gmail.`))return;setDeleting(true);setError("");let failures=0;for(const id of selected){const response=await fetch(`/api/candidates/${id}`,{method:"DELETE"});if(!response.ok)failures++}setDeleting(false);if(failures){setError(`${failures} eliminazioni non riuscite`);return}setSelected([]);router.refresh()}
  const allSelected=rows.length>0&&selected.length===rows.length;
  return <div className="recent-processed"><div className="recent-toolbar"><label><input type="checkbox" checked={allSelected} onChange={()=>setSelected(allSelected?[]:rows.map(row=>row.id))}/> Seleziona tutti</label><button type="button" className="danger-button" disabled={!selected.length||deleting} onClick={remove}>{deleting?<LoaderCircle className="spin" size={14}/>:<Trash2 size={14}/>} Elimina selezionati {selected.length?`(${selected.length})`:""}</button></div>{error&&<p className="form-error">{error}</p>}<div className="recent-list">{rows.map(row=><label key={row.id}><input type="checkbox" checked={selected.includes(row.id)} onChange={()=>toggle(row.id)}/><span><strong>{row.name}</strong><small>{row.filename||"Curriculum senza nome file"}</small></span><time>{new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(row.updatedAt))}</time></label>)}</div></div>;
}
