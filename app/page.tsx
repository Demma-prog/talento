import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, CheckCircle2, FilePlus2, GraduationCap, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CandidatePhoto } from "@/components/CandidateActions";
import { createClient } from "@/lib/supabase/server";

const statusLabels:Record<string,string>={never_contacted:"Mai contattato",to_contact:"Da contattare",contacted:"Contattato",interview_scheduled:"Colloquio programmato",accepted:"Accettato",rejected_after_contact:"Rifiutato dopo il contatto",rejected_directly:"Rifiutato direttamente",unavailable:"Non disponibile",reconsider:"Da rivalutare"};

export default async function Dashboard(){
  const supabase=await createClient();
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  const thirtyDaysAgo=new Date(now.getTime()-30*86400000).toISOString();
  const thirtyDaysAhead=new Date(now.getTime()+30*86400000).toISOString();
  const [activeResult,newResult,contactResult,acceptedResult,expiryResult,reviewResult,incompleteResult,recentResult,educationResult,experienceResult,updatedResult]=await Promise.all([
    supabase.from("candidates").select("id",{count:"exact",head:true}).gte("expires_at",now.toISOString()),
    supabase.from("candidates").select("id",{count:"exact",head:true}).gte("created_at",monthStart),
    supabase.from("candidates").select("id",{count:"exact",head:true}).in("status",["never_contacted","to_contact"]),
    supabase.from("candidates").select("id",{count:"exact",head:true}).eq("status","accepted").gte("updated_at",thirtyDaysAgo),
    supabase.from("candidates").select("id",{count:"exact",head:true}).gte("expires_at",now.toISOString()).lte("expires_at",thirtyDaysAhead),
    supabase.from("candidates").select("id",{count:"exact",head:true}).eq("needs_review",true),
    supabase.from("candidates").select("id",{count:"exact",head:true}).is("normalized_email",null),
    supabase.from("candidates").select("id,first_name,last_name,status,latest_cv_received_at,experiences(role,sort_order)").order("latest_cv_received_at",{ascending:false}).limit(5),
    supabase.from("education").select("candidate_id"),
    supabase.from("experiences").select("id",{count:"exact",head:true}),
    supabase.from("candidates").select("id",{count:"exact",head:true}).gte("updated_at",thirtyDaysAgo),
  ]);
  const active=activeResult.count??0, review=reviewResult.count??0, incomplete=incompleteResult.count??0;
  const complete=Math.max(0,active-review);
  const quality=active?Math.round(complete/active*100):100;
  const educationCandidates=new Set((educationResult.data??[]).map(row=>row.candidate_id)).size;
  const educationRate=active?Math.round(educationCandidates/active*100):0;
  const recent=(recentResult.data??[]).map(row=>{const experiences=Array.isArray(row.experiences)?[...row.experiences].sort((a,b)=>a.sort_order-b.sort_order):[];return{id:row.id,initials:`${row.first_name?.[0]??""}${row.last_name?.[0]??""}`.toUpperCase(),name:`${row.first_name} ${row.last_name}`,role:experiences[0]?.role??"Profilo da definire",date:row.latest_cv_received_at?new Intl.DateTimeFormat("it-IT",{day:"2-digit",month:"short"}).format(new Date(row.latest_cv_received_at)):"—",status:statusLabels[row.status]??row.status}});
  const dateLabel=new Intl.DateTimeFormat("it-IT",{weekday:"long",day:"numeric",month:"long"}).format(now);
  return <AppShell title="Buongiorno, Fabio" eyebrow={dateLabel.charAt(0).toUpperCase()+dateLabel.slice(1)} active="Dashboard">
    <section className="hero-card"><div><span className="soft-label"><Sparkles size={14}/> Archivio aggiornato</span><h2>Il tuo archivio, finalmente ordinato.</h2><p>Importa i nuovi curriculum da Gmail e lascia che il sistema organizzi le informazioni per te.</p></div><Link href="/importa" className="primary-button"><FilePlus2 size={18}/> Importa nuovi CV</Link><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/></section>
    <section className="stats-grid"><article className="stat-card"><span className="stat-icon purple"><UsersRound/></span><div><p>Candidati attivi</p><strong>{active}</strong><small>+{newResult.count??0} questo mese</small></div></article><article className="stat-card"><span className="stat-icon pink"><UserRoundCheck/></span><div><p>Da contattare</p><strong>{contactResult.count??0}</strong><small>Mai contattati o da contattare</small></div></article><article className="stat-card"><span className="stat-icon green"><CheckCircle2/></span><div><p>Accettati</p><strong>{acceptedResult.count??0}</strong><small>Negli ultimi 30 giorni</small></div></article><article className="stat-card"><span className="stat-icon yellow"><CalendarClock/></span><div><p>In scadenza</p><strong>{expiryResult.count??0}</strong><small>Nei prossimi 30 giorni</small></div></article></section>
    <section className="dashboard-grid"><article className="panel recent-panel"><div className="panel-head"><div><p className="eyebrow">Ultimi inserimenti</p><h3>Candidati recenti</h3></div><Link href="/candidati" className="text-link">Vedi tutti <ArrowRight size={16}/></Link></div><div className="candidate-list">{recent.length?recent.map(person=><Link href={`/candidati/${person.id}`} className="candidate-row" key={person.id}><CandidatePhoto candidateId={person.id} initials={person.initials}/><div className="candidate-main"><strong>{person.name}</strong><span>{person.role}</span></div><span className="candidate-date">{person.date}</span><span className={`status status-${person.status.toLowerCase().replaceAll(" ","-")}`}>{person.status}</span><span className="mini-button"><ArrowRight size={16}/></span></Link>):<p className="empty-copy">Nessun candidato importato.</p>}</div></article>
      <aside className="panel overview-panel"><div className="panel-head"><div><p className="eyebrow">Panoramica</p><h3>Qualità archivio</h3></div></div><div className="quality-ring" style={{background:`conic-gradient(var(--purple) 0 ${quality}%,#eeeefd ${quality}%)`}}><div><strong>{quality}%</strong><span>completo</span></div></div><div className="quality-items"><p><span className="legend purple-dot"/>Schede complete <b>{complete}</b></p><p><span className="legend pink-dot"/>Da verificare <b>{review}</b></p><p><span className="legend yellow-dot"/>Senza email <b>{incomplete}</b></p></div></aside></section>
    <section className="mini-insights"><article><GraduationCap/><div><strong>{educationRate}%</strong><span>con istruzione catalogata</span></div></article><article><Briefcase/><div><strong>{experienceResult.count??0}</strong><span>esperienze catalogate</span></div></article><article><Sparkles/><div><strong>{updatedResult.count??0}</strong><span>profili aggiornati in 30 giorni</span></div></article></section>
  </AppShell>
}
