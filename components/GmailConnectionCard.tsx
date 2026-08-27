"use client";
import { useEffect, useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = { configured:boolean; connected:boolean; connection?:{email_address:string} };
export function GmailConnectionCard(){
  const [status,setStatus]=useState<Status|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const api=process.env.NEXT_PUBLIC_API_URL;
  async function jwt(){const {data}=await createClient().auth.getSession();if(!data.session)throw new Error("Sessione scaduta");return data.session.access_token}
  useEffect(()=>{if(!api)return;void jwt().then(t=>fetch(`${api}/gmail/status`,{headers:{Authorization:`Bearer ${t}`}})).then(r=>r.ok?r.json():Promise.reject()).then(setStatus).catch(()=>setError("Backend Gmail non ancora disponibile."))},[api]);
  async function connect(){setLoading(true);setError("");try{if(!api)throw new Error("Configura NEXT_PUBLIC_API_URL");const r=await fetch(`${api}/gmail/connect`,{headers:{Authorization:`Bearer ${await jwt()}`}});const body=await r.json();if(!r.ok)throw new Error(body.detail??"Configurazione incompleta");window.location.assign(body.authorization_url)}catch(e){setError(e instanceof Error?e.message:"Collegamento non riuscito");setLoading(false)}}
  return <article className="panel setting-card"><div className="setting-title"><span><Mail/></span><div><h3>Casella Gmail</h3><p>{status?.connected?status.connection?.email_address:"Casella dedicata alla ricezione dei curriculum"}</p></div><em className={`connection-badge ${status?.connected?"connected":""}`}>{status?.connected?"Collegata":"Da collegare"}</em></div><label>Query di ricerca Gmail<input defaultValue="has:attachment newer_than:1y"/></label>{error&&<div className="login-error">{error}</div>}<button className="secondary-button" onClick={connect} disabled={loading||status?.connected}>{loading?<><LoaderCircle className="spin"/>Apertura Google...</>:status?.connected?"Gmail collegata":"Collega Gmail"}</button></article>
}
