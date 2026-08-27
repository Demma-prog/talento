import Link from "next/link";
import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getCandidates } from "@/lib/data/candidates";

export default async function CandidatesPage(){const {data:people,demo}=await getCandidates();return <AppShell title="Candidati" active="Candidati">
  <section className="list-toolbar panel"><div><h2>Tutti i candidati</h2><p>{people.length} profili unici, ordinati per ultimo curriculum ricevuto {demo&&<span className="demo-badge">Modalità demo</span>}</p></div><div className="toolbar-actions"><button className="secondary-button"><Filter size={16}/> Filtri</button><Link href="/importa" className="primary-button purple-button"><Plus size={17}/> Importa CV</Link></div></section>
  <section className="panel candidates-table-card">
    <div className="table-tools"><label className="search wide"><Search size={17}/><input placeholder="Nome, ruolo, città o competenza..."/></label><button className="secondary-button"><SlidersHorizontal size={16}/> Stato: tutti</button></div>
    <div className="people-table"><div className="people-row people-head"><span>Candidato</span><span>Profilo</span><span>Località</span><span>Stato</span><span>Ultimo CV</span></div>{people.map((p,i)=><Link href={demo?"/candidati/martina-russo":`/candidati/${p.id}`} className="people-row" key={p.id}><span className={`candidate-cell avatar-${i%5}`}><i>{p.initials}</i><b>{p.name}</b></span><span>{p.role}</span><span>{p.city}</span><span><em className={`status status-${p.status.toLowerCase().replaceAll(" ","-")}`}>{p.status}</em></span><span>{p.receivedAt}</span></Link>)}</div>
  </section>
</AppShell>}
