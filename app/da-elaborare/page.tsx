import { AppShell } from "@/components/AppShell";
import { PendingProcessor } from "@/components/PendingProcessor";
import { createClient } from "@/lib/supabase/server";
import { CheckCircle2, ListRestart } from "lucide-react";

export default async function PendingPage(){
  const supabase=await createClient();const {data}=await supabase.from("pending_cv_imports").select("id,filename,subject,sender,received_at,last_error").order("received_at",{ascending:false}).limit(1000);const rows=data??[];
  return <AppShell title="Da elaborare" eyebrow="Coda CV" active="Da elaborare"><section className="queue-summary panel"><span className="queue-icon"><ListRestart/></span><div><h2>{rows.length}</h2><p>CV già acquisiti da Gmail e in attesa dell’analisi. Non devi importarli nuovamente.</p></div><PendingProcessor count={rows.length}/></section><section className="panel queue-panel"><div className="panel-head"><div><p className="eyebrow">In attesa</p><h3>Curriculum da elaborare</h3></div></div>{rows.length?<div className="queue-list">{rows.map(row=><article key={row.id}><span className="candidate-avatar lavender"><ListRestart size={17}/></span><div><strong>{row.filename}</strong><p>{row.subject||"Senza oggetto"} · {row.sender||"Mittente non indicato"}</p>{row.last_error&&<small>{row.last_error}</small>}</div></article>)}</div>:<div className="queue-empty"><CheckCircle2/><strong>Nessun CV in attesa</strong><p>La coda di elaborazione è vuota.</p></div>}</section></AppShell>
}
