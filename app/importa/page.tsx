"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, FileSearch, Inbox, LoaderCircle, Mail, Play, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";

type ScanMessage = { message_id: string; subject: string; sender: string; received_at: string; attachments: { filename: string }[] };
type ScanResult = { found_count: number; messages: ScanMessage[]; message: string };
type ProcessResult = { imported: number; updated: number; duplicate: number; failed: number };

export default function ImportPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState("");

  async function scan() {
    setRunning(true); setError(""); setProcessResult(null);
    try {
      const api = process.env.NEXT_PUBLIC_API_URL;
      if (!api) throw new Error("Backend non configurato");
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessione scaduta: accedi nuovamente");
      const response = await fetch(`${api}/imports`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ max_messages: 10 }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Scansione non riuscita");
      setResult(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Scansione non riuscita"); }
    finally { setRunning(false); }
  }

  async function processCvs() {
    if (!result?.messages.length) return;
    setRunning(true); setError("");
    try {
      const api = process.env.NEXT_PUBLIC_API_URL;
      if (!api) throw new Error("Backend non configurato");
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessione scaduta: accedi nuovamente");
      const response = await fetch(`${api}/imports/process`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message_ids: result.messages.slice(0, 3).map(message=>message.message_id) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail ?? "Importazione non riuscita");
      setProcessResult(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Importazione non riuscita"); }
    finally { setRunning(false); }
  }

  return <AppShell title="Importa curriculum" active="Importa CV">
    <section className="import-hero panel"><span className="import-icon"><Inbox/></span><div><p className="eyebrow">Sincronizzazione manuale</p><h2>Importa i nuovi CV da Gmail</h2><p>Per questa prima verifica cerchiamo fino a 10 email con allegati PDF o Word, senza inviare ancora documenti a Gemini.</p></div><button className="primary-button purple-button" disabled={running} onClick={scan}>{running?<><LoaderCircle className="spin"/> Ricerca...</>:<><Play/> Cerca CV su Gmail</>}</button></section>
    {error && <section className="import-feedback import-error"><strong>Scansione non riuscita</strong><span>{error}</span></section>}
    {result && <section className="panel scan-results"><div className="panel-head"><div><p className="eyebrow">Verifica Gmail completata</p><h3>{result.found_count} email con CV trovate</h3></div><CheckCircle2 className="result-check"/></div><p className="scan-note">{result.message}</p><div className="scan-list">{result.messages.map(message=><article key={message.message_id}><span className="candidate-avatar lavender"><Mail size={17}/></span><div><strong>{message.subject}</strong><p>{message.sender}</p></div><div className="scan-files">{message.attachments.map(file=><span key={file.filename}>{file.filename}</span>)}</div></article>)}</div>{result.messages.length>0&&!processResult&&<button className="primary-button purple-button process-button" disabled={running} onClick={processCvs}>{running?<><LoaderCircle className="spin"/> Analisi...</>:<><Sparkles/> Analizza i primi {Math.min(3,result.messages.length)} CV</>}</button>}{processResult&&<div className="process-summary"><strong>Importazione completata</strong><span>Nuovi: {processResult.imported}</span><span>Aggiornati: {processResult.updated}</span><span>Già presenti: {processResult.duplicate}</span><span>Errori: {processResult.failed}</span></div>}</section>}
    <section className="import-grid"><article className="panel import-process"><div className="panel-head"><div><p className="eyebrow">Come funziona</p><h3>Processo di importazione</h3></div></div>{[[Mail,"Legge le nuove email","Ricerca solo i messaggi con allegati PDF o Word."],[FileSearch,"Estrae i dati","Legge il CV e struttura esperienze, istruzione e contatti."],[Sparkles,"Organizza con Gemini","Compila le card e segnala i campi che richiedono verifica."],[CheckCircle2,"Salva senza duplicati","Aggiorna la scheda esistente quando trova un CV più recente."]].map(([Icon,title,copy],i)=>{const I=Icon as typeof Mail;return <div className="process-step" key={String(title)}><span>{i+1}</span><i><I size={20}/></i><div><strong>{String(title)}</strong><p>{String(copy)}</p></div></div>})}</article>
      <aside><article className="panel sync-card"><p className="eyebrow">Ultima attività</p><h3>Sincronizzazione</h3><div className="sync-stat"><span>Ultima scansione</span><b>{result?"Appena eseguita":"Non ancora eseguita"}</b></div><div className="sync-stat"><span>Email trovate</span><b>{result?.found_count??0}</b></div><div className="sync-stat"><span>Errori</span><b>{error?1:0}</b></div><button className="secondary-button full" disabled={running} onClick={scan}><RotateCcw size={15}/> Controlla collegamento</button></article><article className="privacy-note"><ShieldCheck/><div><strong>Elaborazione protetta</strong><p>In questa fase leggiamo soltanto i metadati degli allegati. I CV restano archiviati in Gmail.</p></div></article></aside></section>
  </AppShell>;
}
