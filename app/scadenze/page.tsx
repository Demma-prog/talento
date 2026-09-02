import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CandidatePhoto } from "@/components/CandidateActions";
import { createClient } from "@/lib/supabase/server";

const day=86_400_000;
const dateLabel=(value:string)=>new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"long",year:"numeric"}).format(new Date(value));

export default async function ExpiryPage(){
  const supabase=await createClient();
  const now=new Date(); const limit=new Date(now.getTime()+30*day);
  const {data}=await supabase.from("candidates").select("id,first_name,last_name,city,expires_at").not("expires_at","is",null).lte("expires_at",limit.toISOString()).order("expires_at",{ascending:true}).limit(1000);
  const people=(data??[]).map(person=>{const days=Math.ceil((new Date(person.expires_at!).getTime()-now.getTime())/day);return{...person,days}});
  return <AppShell title="CV in scadenza" eyebrow="Conservazione 365 giorni" active="CV in scadenza">
    <section className="queue-summary panel"><span className="queue-icon"><Clock3/></span><div><h2>{people.length}</h2><p>Profili scaduti o che raggiungeranno il termine di conservazione nei prossimi 30 giorni.</p></div></section>
    <section className="panel queue-panel"><div className="panel-head"><div><p className="eyebrow">Eliminazione programmata</p><h3>CV in scadenza</h3></div><span className="soft-count">{people.length} profili</span></div>{people.length?<div className="queue-list">{people.map(person=>{const initials=`${person.first_name?.[0]??""}${person.last_name?.[0]??""}`.toUpperCase();const reason=person.days<0?`Scaduto da ${Math.abs(person.days)} giorni`:person.days===0?"Scade oggi":`Scade tra ${person.days} giorni`;return <article key={person.id}><CandidatePhoto candidateId={person.id} initials={initials}/><div><strong>{person.first_name} {person.last_name}</strong><p>{person.city??"Città non indicata"} · {dateLabel(person.expires_at!)}</p></div><span className={`priority ${person.days<=7?"priority-urgente":person.days<=15?"priority-alta":"priority-media"}`}><CircleAlert size={12}/>{reason}</span><Link href={`/candidati/${person.id}`} className="text-link">Apri candidato<ArrowRight size={15}/></Link></article>})}</div>:<div className="queue-empty"><CheckCircle2/><strong>Nessun CV in scadenza</strong><p>Non risultano profili da eliminare nei prossimi 30 giorni.</p></div>}</section>
    <div className="queue-tip"><CheckCircle2/><div><strong>Conservazione automatica</strong><p>Alla successiva importazione, le schede oltre i 365 giorni vengono eliminate insieme alla foto salvata. L’email originale rimane in Gmail.</p></div></div>
  </AppShell>;
}
