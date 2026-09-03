"use client";

import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, FileSearch, Inbox, LoaderCircle, Mail, Play, RotateCcw, ShieldCheck, Sparkles, Square } from "lucide-react";

type ScanMessage={message_id:string;subject:string;sender:string;received_at:string;attachments:{filename:string}[]};
type ScanResult={found_count:number;messages:ScanMessage[];next_page_token:string|null;has_more:boolean;estimated_total:number};
type Totals={imported:number;updated:number;duplicate:number;failed:number};
const emptyTotals:Totals={imported:0,updated:0,duplicate:0,failed:0};
function formatDuration(value:number){
  const seconds=Math.max(0,Math.round(value||0));
  if(seconds<60)return `${seconds}s`;
  const minutes=Math.ceil(seconds/60);
  if(minutes<60)return `${minutes} min`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return rest?`${hours} h ${rest} min`:`${hours} h`;
}

export default function ImportPage(){
  const [running,setRunning]=useState(false);
  const [complete,setComplete]=useState(false);
  const [phase,setPhase]=useState("Pronto per iniziare");
  const [currentPage,setCurrentPage]=useState<ScanResult|null>(null);
  const [pageNumber,setPageNumber]=useState(0);
  const [pageProcessed,setPageProcessed]=useState(0);
  const [overallProcessed,setOverallProcessed]=useState(0);
  const [estimatedTotal,setEstimatedTotal]=useState(0);
  const [secondsPerMessage,setSecondsPerMessage]=useState(0);
  const [queryAfterEpoch,setQueryAfterEpoch]=useState<number|null>(null);
  const [totals,setTotals]=useState<Totals>(emptyTotals);
  const [error,setError]=useState("");
  const [importErrors,setImportErrors]=useState<string[]>([]);
  const cancelRequested=useRef(false);

  async function accessToken(){const {data}=await createClient().auth.getSession();if(!data.session)throw new Error("Sessione scaduta: accedi nuovamente");return data.session.access_token}
  async function apiRequest(path:string,body:unknown,retries=20):Promise<any>{
    const api=process.env.NEXT_PUBLIC_BACKEND_URL||process.env.NEXT_PUBLIC_API_URL;if(!api)throw new Error("Backend non configurato");
    let lastError:Error|null=null;
    for(let attempt=0;attempt<=retries;attempt++){
      if(cancelRequested.current)throw new Error("Importazione interrotta");
      try{
        const response=await fetch(`${api}${path}`,{method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
        const data=await response.json().catch(()=>({detail:`Errore temporaneo del backend (${response.status})`}));
        if(response.ok)return data;
        const retryable=response.status===408||response.status===429||response.status>=500;
        if(!retryable){const fatal=new Error(data.detail??"Operazione non riuscita") as Error&{fatal?:boolean};fatal.fatal=true;throw fatal}
        lastError=new Error(data.detail??`Backend temporaneamente non disponibile (${response.status})`);
      }catch(cause){if(cause instanceof Error&&(cause as Error&{fatal?:boolean}).fatal)throw cause;lastError=cause instanceof Error?cause:new Error("Connessione temporaneamente non disponibile")}
      if(attempt<retries){
        const seconds=Math.min(10,2+attempt);
        setPhase(`Connessione temporaneamente assente · nuovo tentativo tra ${seconds}s`);
        await new Promise(resolve=>setTimeout(resolve,seconds*1000));
      }
    }
    throw lastError;
  }
  function stop(){cancelRequested.current=true;setPhase("Interruzione dopo il gruppo corrente...")}
  async function start(){
    cancelRequested.current=false;setRunning(true);setComplete(false);setError("");setImportErrors([]);setTotals(emptyTotals);setOverallProcessed(0);setEstimatedTotal(0);setSecondsPerMessage(0);setPageNumber(0);setCurrentPage(null);
    let cursor:string|null=null;let afterEpoch:number|null=null;let page=0;let processed=0;let estimate=0;let session={...emptyTotals};
    try{
      setPhase("Recupero dell’ultimo punto raggiunto...");
      const position=await apiRequest("/imports/position",{});
      cursor=position.page_token;afterEpoch=position.after_epoch;setQueryAfterEpoch(afterEpoch);
      setPhase("Conteggio delle email ancora da verificare...");
      const forecast=await apiRequest("/imports/estimate",{page_token:cursor,after_epoch:afterEpoch});
      estimate=forecast.total_messages;setEstimatedTotal(estimate);setSecondsPerMessage(forecast.seconds_per_message||0);
      setPhase(`Trovate ${estimate} email · tempo previsto ${formatDuration(forecast.estimated_seconds)}`);
      do{
        if(cancelRequested.current)break;
        setPhase("Ricerca delle email con curriculum...");
        const scan:ScanResult=await apiRequest("/imports",{max_messages:10,page_token:cursor,after_epoch:afterEpoch});
        page+=1;setPageNumber(page);setCurrentPage(scan);setPageProcessed(0);
        estimate=Math.max(estimate,processed+scan.messages.length);setEstimatedTotal(estimate);
        for(let offset=0;offset<scan.messages.length;offset+=3){
          if(cancelRequested.current)break;
          const batch=scan.messages.slice(offset,offset+3);
          setPhase(`Analisi dei CV ${processed+1}–${processed+batch.length}...`);
          const result=await apiRequest("/imports/process",{message_ids:batch.map(item=>item.message_id)});
          if(result.errors?.length){setImportErrors(current=>[...current,...result.errors]);setError(result.errors.join(" • "))}
          session={imported:session.imported+result.imported,updated:session.updated+result.updated,duplicate:session.duplicate+result.duplicate,failed:session.failed+result.failed};
          if(result.failed)throw new Error(result.errors.join(" • "));
          processed+=batch.length;setTotals(session);setOverallProcessed(processed);setPageProcessed(Math.min(offset+batch.length,scan.messages.length));
        }
        if(!cancelRequested.current)await apiRequest("/imports/checkpoint",{next_page_token:scan.next_page_token,after_epoch:afterEpoch,processed_count:processed,complete:!scan.next_page_token});
        cursor=scan.next_page_token;
        if(cancelRequested.current)break;
      }while(cursor);
      if(cancelRequested.current){setPhase("Importazione interrotta");setComplete(false)}
      else{setPhase("Importazione completata");setComplete(true);setOverallProcessed(value=>Math.max(value,estimate))}
    }catch(cause){setError(cause instanceof Error?cause.message:"Importazione non riuscita");setPhase("Importazione sospesa")}
    finally{setRunning(false)}
  }
  async function resume(){
    if(!currentPage)return start();
    cancelRequested.current=false;setRunning(true);setComplete(false);setError("");
    let scan=currentPage;let page=pageNumber;let processed=overallProcessed;let estimate=estimatedTotal;let session={...totals};let firstOffset=pageProcessed;
    try{
      while(true){
        for(let offset=firstOffset;offset<scan.messages.length;offset+=3){
          if(cancelRequested.current)break;
          const batch=scan.messages.slice(offset,offset+3);
          setPhase(`Analisi dei CV ${processed+1}–${processed+batch.length}...`);
          const result=await apiRequest("/imports/process",{message_ids:batch.map(item=>item.message_id)});
          if(result.errors?.length){setImportErrors(current=>[...current,...result.errors]);setError(result.errors.join(" • "))}
          session={imported:session.imported+result.imported,updated:session.updated+result.updated,duplicate:session.duplicate+result.duplicate,failed:session.failed+result.failed};
          if(result.failed)throw new Error(result.errors.join(" • "));
          processed+=batch.length;setTotals(session);setOverallProcessed(processed);setPageProcessed(Math.min(offset+batch.length,scan.messages.length));
        }
        if(!cancelRequested.current)await apiRequest("/imports/checkpoint",{next_page_token:scan.next_page_token,after_epoch:queryAfterEpoch,processed_count:processed,complete:!scan.next_page_token});
        if(cancelRequested.current||!scan.next_page_token)break;
        setPhase("Ricerca delle email con curriculum...");
        scan=await apiRequest("/imports",{max_messages:10,page_token:scan.next_page_token,after_epoch:queryAfterEpoch});
        page+=1;firstOffset=0;estimate=Math.max(estimate,scan.estimated_total||0,processed+scan.messages.length);
        setCurrentPage(scan);setPageNumber(page);setPageProcessed(0);setEstimatedTotal(estimate);
      }
      if(cancelRequested.current){setPhase("Importazione interrotta")}
      else{setPhase("Importazione completata");setComplete(true);setOverallProcessed(value=>Math.max(value,estimate))}
    }catch(cause){setError(cause instanceof Error?cause.message:"Importazione non riuscita");setPhase("Importazione sospesa")}
    finally{setRunning(false)}
  }
  const progress=complete?100:estimatedTotal?Math.min(99,Math.round(overallProcessed/estimatedTotal*100)):0;
  const remainingSeconds=Math.max(0,estimatedTotal-overallProcessed)*secondsPerMessage;

  return <AppShell title="Importa curriculum" active="Importa CV">
    <section className="import-hero panel"><span className="import-icon"><Inbox/></span><div><p className="eyebrow">Importazione automatica</p><h2>Importa e organizza tutti i CV</h2><p>Un solo clic avvia l’intero archivio. Il sistema gestisce autonomamente i piccoli gruppi necessari per rispettare i limiti dei servizi gratuiti.</p></div>{running?<button className="secondary-button stop-import" onClick={stop}><Square size={15}/> Interrompi</button>:<button className="primary-button purple-button" onClick={overallProcessed&&!complete?resume:start}><Play/> {overallProcessed&&!complete?"Riprendi importazione":"Avvia importazione"}</button>}</section>
    <section className="panel automatic-progress"><div className="panel-head"><div><p className="eyebrow">Stato del processo</p><h3>{phase}</h3></div><strong className="progress-percent">{progress}%</strong></div><div className="overall-progress"><i style={{width:`${progress}%`}}/></div><div className="progress-metrics"><span><b>{overallProcessed}</b>Email elaborate</span><span><b>{estimatedTotal||"—"}</b>Email da verificare</span><span><b>{secondsPerMessage?formatDuration(remainingSeconds):"—"}</b>Tempo rimanente</span><span><b>{currentPage?`${pageProcessed}/${currentPage.messages.length}`:"—"}</b>Blocco corrente</span></div>{error&&<div className="import-feedback import-error"><strong>Processo sospeso</strong><span>{error}</span></div>}{complete&&<div className="import-complete wide-complete"><CheckCircle2/> Tutte le email individuate sono state esaminate.</div>}</section>
    {currentPage&&running&&<section className="panel current-batch"><div className="panel-head"><div><p className="eyebrow">Elaborazione in corso</p><h3>Pagina Gmail {pageNumber}</h3></div><LoaderCircle className="spin result-check"/></div><div className="scan-list compact-scan">{currentPage.messages.map((message,index)=><article key={message.message_id} className={index<pageProcessed?"scan-processed":""}><span className="candidate-avatar lavender">{index<pageProcessed?<CheckCircle2 size={17}/>:<Mail size={17}/>}</span><div><strong>{message.subject}</strong><p>{message.sender}</p></div><div className="scan-files">{message.attachments.map(file=><span key={file.filename}>{file.filename}</span>)}</div></article>)}</div></section>}
    <section className="import-grid"><article className="panel import-process"><div className="panel-head"><div><p className="eyebrow">Processo automatico</p><h3>Cosa sta facendo Talento</h3></div></div>{[[Mail,"Scorre tutto Gmail","Carica automaticamente una pagina dopo l’altra."],[FileSearch,"Seleziona il curriculum","Distingue il CV dagli allegati accessori."],[Sparkles,"Analizza con Gemini","Estrae dati, percorso, competenze e foto."],[CheckCircle2,"Aggiorna senza duplicati","Conserva un profilo per persona e il CV più recente."]].map(([Icon,title,copy],i)=>{const I=Icon as typeof Mail;return <div className="process-step" key={String(title)}><span>{i+1}</span><i><I size={20}/></i><div><strong>{String(title)}</strong><p>{String(copy)}</p></div></div>})}</article>
      <aside><article className="panel sync-card"><p className="eyebrow">Risultati sessione</p><h3>Riepilogo</h3><div className="sync-stat"><span>Nuovi candidati</span><b>{totals.imported}</b></div><div className="sync-stat"><span>Profili aggiornati</span><b>{totals.updated}</b></div><div className="sync-stat"><span>Già presenti</span><b>{totals.duplicate}</b></div><div className="sync-stat"><span>Errori</span><b>{totals.failed}</b></div>{!running&&overallProcessed>0&&<button className="secondary-button full" onClick={start}><RotateCcw size={15}/> Esegui nuovamente</button>}</article><article className="privacy-note"><ShieldCheck/><div><strong>Tieni aperta questa pagina</strong><p>Nel piano gratuito il browser coordina il lavoro. Puoi usare altre schede, ma non chiudere questa pagina finché l’importazione non è terminata.</p></div></article></aside></section>
  </AppShell>
}
