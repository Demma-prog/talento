import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, CheckCircle2, FilePlus2, GraduationCap, MoreHorizontal, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";

const recent = [
  { initials: "MR", name: "Martina Russo", role: "Addetta vendite", date: "Oggi, 10:42", status: "Da contattare", tone: "lavender" },
  { initials: "LC", name: "Luca Conti", role: "Store manager", date: "Ieri, 17:18", status: "Da verificare", tone: "peach" },
  { initials: "GS", name: "Giulia Serra", role: "Visual merchandiser", date: "24 ago, 09:35", status: "Contattato", tone: "mint" },
  { initials: "AM", name: "Andrea Moretti", role: "Addetto magazzino", date: "23 ago, 14:10", status: "Mai contattato", tone: "blue" },
];

export default function Dashboard() {
  return (
    <AppShell title="Buongiorno, Fabio" eyebrow="Giovedì 27 agosto" active="Dashboard">
      <section className="hero-card">
        <div><span className="soft-label"><Sparkles size={14} /> Tutto sotto controllo</span><h2>Il tuo archivio, finalmente ordinato.</h2><p>Importa i nuovi curriculum da Gmail e lascia che il sistema organizzi le informazioni per te.</p></div>
        <Link href="/importa" className="primary-button"><FilePlus2 size={18} /> Importa nuovi CV</Link>
        <div className="hero-orb orb-one" /><div className="hero-orb orb-two" />
      </section>

      <section className="stats-grid">
        <article className="stat-card"><span className="stat-icon purple"><UsersRound /></span><div><p>Candidati attivi</p><strong>248</strong><small>+12 questo mese</small></div></article>
        <article className="stat-card"><span className="stat-icon pink"><UserRoundCheck /></span><div><p>Da contattare</p><strong>18</strong><small>7 ad alta priorità</small></div></article>
        <article className="stat-card"><span className="stat-icon green"><CheckCircle2 /></span><div><p>Accettati</p><strong>14</strong><small>Negli ultimi 30 giorni</small></div></article>
        <article className="stat-card"><span className="stat-icon yellow"><CalendarClock /></span><div><p>In scadenza</p><strong>9</strong><small>Entro questo mese</small></div></article>
      </section>

      <section className="dashboard-grid">
        <article className="panel recent-panel">
          <div className="panel-head"><div><p className="eyebrow">Ultimi inserimenti</p><h3>Candidati recenti</h3></div><Link href="/candidati" className="text-link">Vedi tutti <ArrowRight size={16} /></Link></div>
          <div className="candidate-list">
            {recent.map((person) => <div className="candidate-row" key={person.name}><span className={`candidate-avatar ${person.tone}`}>{person.initials}</span><div className="candidate-main"><strong>{person.name}</strong><span>{person.role}</span></div><span className="candidate-date">{person.date}</span><span className={`status status-${person.status.toLowerCase().replaceAll(" ", "-")}`}>{person.status}</span><button className="mini-button"><MoreHorizontal size={18} /></button></div>)}
          </div>
        </article>

        <aside className="panel overview-panel">
          <div className="panel-head"><div><p className="eyebrow">Panoramica</p><h3>Qualità archivio</h3></div></div>
          <div className="quality-ring"><div><strong>92%</strong><span>completo</span></div></div>
          <div className="quality-items"><p><span className="legend purple-dot" />Schede complete <b>229</b></p><p><span className="legend pink-dot" />Da verificare <b>15</b></p><p><span className="legend yellow-dot" />Possibili duplicati <b>4</b></p></div>
        </aside>
      </section>

      <section className="mini-insights">
        <article><GraduationCap /><div><strong>62%</strong><span>con diploma o laurea</span></div></article>
        <article><Briefcase /><div><strong>4,2 anni</strong><span>esperienza media</span></div></article>
        <article><Sparkles /><div><strong>31</strong><span>profili aggiornati</span></div></article>
      </section>
    </AppShell>
  );
}
