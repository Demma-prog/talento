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
