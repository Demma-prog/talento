import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, FileQuestion, RefreshCw, UserRoundSearch } from "lucide-react";
import { AppShell } from "./AppShell";

type QueueKind = "duplicates" | "incomplete" | "expiry";

const content = {
  duplicates: { active: "Possibili duplicati", title: "Possibili duplicati", eyebrow: "Controllo archivio", icon: UserRoundSearch, count: "2", description: "Verifica questi abbinamenti prima di unire le schede.", action: "Confronta profili", rows: [["Martina Russo", "Stessa email, CV differente", "Alta"], ["Andrea Moretti", "Stesso telefono", "Media"]] },
  incomplete: { active: "Dati incompleti", title: "Dati incompleti", eyebrow: "Revisione necessaria", icon: FileQuestion, count: "4", description: "Alcuni campi non sono stati trovati o hanno una bassa affidabilità.", action: "Completa scheda", rows: [["Luca Conti", "Anno di nascita mancante", "Alta"], ["Andrea Moretti", "Luogo di nascita mancante", "Media"], ["Elena Ferri", "Esperienza da verificare", "Media"], ["Paolo Galli", "Contatto non riconosciuto", "Bassa"]] },
  expiry: { active: "CV in scadenza", title: "CV in scadenza", eyebrow: "Conservazione 365 giorni", icon: Clock3, count: "9", description: "Questi profili raggiungeranno presto il termine di conservazione.", action: "Apri candidato", rows: [["Sara Villa", "Scade tra 5 giorni", "Urgente"], ["Marco Riva", "Scade tra 12 giorni", "Alta"], ["Ilaria Costa", "Scade tra 19 giorni", "Media"]] },
} as const;

export function QueuePage({ kind }: { kind: QueueKind }) {
  const item = content[kind];
  const Icon = item.icon;
  return <AppShell title={item.title} eyebrow={item.eyebrow} active={item.active}>
    <section className="queue-summary panel"><span className="queue-icon"><Icon /></span><div><h2>{item.count}</h2><p>{item.description}</p></div><button className="secondary-button"><RefreshCw size={15}/> Aggiorna controllo</button></section>
    <section className="panel queue-panel"><div className="panel-head"><div><p className="eyebrow">Elementi da gestire</p><h3>{item.title}</h3></div><span className="soft-count">{item.rows.length} visibili</span></div><div className="queue-list">{item.rows.map(([name, reason, priority]) => <article key={name}><span className="candidate-avatar lavender">{name.split(" ").map(x=>x[0]).join("")}</span><div><strong>{name}</strong><p>{reason}</p></div><span className={`priority priority-${priority.toLowerCase()}`}><CircleAlert size={12}/>{priority}</span><Link href="/candidati/martina-russo" className="text-link">{item.action}<ArrowRight size={15}/></Link></article>)}</div></section>
    <div className="queue-tip"><CheckCircle2/><div><strong>Nessuna modifica automatica</strong><p>Le unioni, le correzioni e le eliminazioni richiedono sempre una conferma esplicita.</p></div></div>
  </AppShell>
}
