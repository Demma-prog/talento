import Link from "next/link";
import { Filter, Plus, Search, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CandidatePhoto } from "@/components/CandidateActions";
import { CandidateFilters, getCandidates } from "@/lib/data/candidates";

const profiles=[['accounting','Contabilità'],['logistics','Logistica'],['marketing','Marketing'],['cashier','Cassiere/a'],['sales','Commesso/a'],['warehouse','Magazzino'],['other','Altro']];
const profileLabels=Object.fromEntries(profiles);
const statuses=[['never_contacted','Mai contattato'],['to_contact','Da contattare'],['contacted','Contattato'],['interview_scheduled','Colloquio programmato'],['accepted','Accettato'],['rejected_after_contact','Rifiutato dopo il contatto'],['rejected_directly','Rifiutato direttamente']];
const genderLabels:Record<string,string>={female:'Donna',male:'Uomo',other:'Altro'};

export default async function CandidatesPage({searchParams}:{searchParams:Promise<CandidateFilters>}){
  const filters=await searchParams;const {data:people,demo,cities,total}=await getCandidates(filters);
  const hasFilters=Object.values(filters).some(Boolean);
  return <AppShell title="Candidati" active="Candidati">
    <section className="list-toolbar panel"><div><h2>Tutti i candidati</h2><p>{total} profili trovati {demo&&<span className="demo-badge">Modalità demo</span>}</p></div><div className="toolbar-actions">{hasFilters&&<Link href="/candidati" className="secondary-button"><X size={15}/> Azzera filtri</Link>}<Link href="/importa" className="primary-button purple-button"><Plus size={17}/> Importa CV</Link></div></section>
    <form className="panel candidate-filters" method="get"><div className="filter-search"><Search size={17}/><input name="q" defaultValue={filters.q} placeholder="Nome, email, ruolo o competenza..."/></div><div className="filter-grid">
      <label>Età minima<input type="number" name="age_min" min="16" max="90" defaultValue={filters.age_min}/></label><label>Età massima<input type="number" name="age_max" min="16" max="90" defaultValue={filters.age_max}/></label>
      <label>Sesso<select name="gender" defaultValue={filters.gender??""}><option value="">Tutti</option><option value="female">Donna</option><option value="male">Uomo</option><option value="other">Altro dichiarato</option></select></label>
      <label>Città<select name="city" defaultValue={filters.city??""}><option value="">Tutte</option>{cities.map(city=><option value={city} key={city}>{city}</option>)}</select></label>
      <label>Categoria<select name="profile" defaultValue={filters.profile??""}><option value="">Tutte</option>{profiles.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label>Esperienza minima<select name="experience_min" defaultValue={filters.experience_min??""}><option value="">Qualsiasi</option><option value="1">1 anno</option><option value="3">3 anni</option><option value="5">5 anni</option><option value="10">10 anni</option></select></label>
      <label>Stato<select name="status" defaultValue={filters.status??""}><option value="">Tutti</option>{statuses.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label className="review-filter"><input type="checkbox" name="review" value="true" defaultChecked={filters.review==="true"}/><span>Solo da verificare</span></label><button className="primary-button purple-button filter-submit"><Filter size={16}/> Applica filtri</button>
    </div></form>
    <section className="panel candidates-table-card"><div className="people-table"><div className="people-row people-head"><span>Candidato</span><span>Categoria</span><span>Località</span><span>Stato</span><span>Ultimo CV</span></div>{people.length?people.map((p,i)=><Link href={demo?"/candidati/martina-russo":`/candidati/${p.id}`} className="people-row" key={p.id}><span className={`candidate-cell avatar-${i%5}`}><CandidatePhoto candidateId={p.id} initials={p.initials}/><span><b>{p.name}</b><small>{p.birthYear?`${new Date().getFullYear()-p.birthYear} anni`:"Età non indicata"} · {genderLabels[p.gender??""]??"Sesso non indicato"}</small></span></span><span className="profile-cell"><b>{profileLabels[p.profile]??"Altro"}</b><small>{p.role} · {p.experienceYears} anni</small></span><span>{p.city}</span><span><em className={`status status-${p.status.toLowerCase().replaceAll(" ","-")}`}>{p.status}</em></span><span>{p.receivedAt}</span></Link>):<div className="filter-empty"><Search/><strong>Nessun candidato corrisponde ai filtri</strong><Link href="/candidati" className="text-link">Azzera la ricerca</Link></div>}</div></section>
  </AppShell>
}
