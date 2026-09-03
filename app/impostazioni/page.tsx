import { AppShell } from "@/components/AppShell";
import { Bot, CalendarClock, Database, ShieldCheck } from "lucide-react";
import { GmailConnectionCard } from "@/components/GmailConnectionCard";

export default function SettingsPage(){return <AppShell title="Impostazioni" active="Impostazioni">
  <section className="settings-grid"><div className="settings-main">
    <GmailConnectionCard />
    <article className="panel setting-card"><div className="setting-title"><span><Bot/></span><div><h3>Estrazione locale</h3><p>Qwen 3 4B tramite Ollama sul computer</p></div><em className="connection-badge connected">Configurato</em></div><label>Modello<select defaultValue="qwen3:4b" disabled><option value="qwen3:4b">Qwen 3 · 4B</option></select></label><label className="toggle-row"><span><b>Genera sintesi del profilo</b><small>Crea la card Bio quando non è presente nel CV</small></span><input type="checkbox" defaultChecked disabled/></label></article>
    <article className="panel setting-card"><div className="setting-title"><span><CalendarClock/></span><div><h3>Conservazione</h3><p>Regole applicate ai dati dei candidati</p></div></div><label>Durata conservazione<select defaultValue="365"><option value="365">365 giorni</option><option value="180">180 giorni</option></select></label><label className="toggle-row"><span><b>Segnala prima della scadenza</b><small>Mostra un avviso 30 giorni prima</small></span><input type="checkbox" defaultChecked/></label></article>
  </div><aside className="settings-side"><article className="panel"><ShieldCheck className="settings-shield"/><h3>Sicurezza</h3><p>Credenziali Gmail e Supabase restano nelle variabili protette del backend. I testi elaborati localmente non vengono inviati a servizi AI esterni.</p></article><article className="panel"><Database className="settings-shield"/><h3>Supabase</h3><p>Database collegato all’archivio Talento.</p></article></aside></section>
</AppShell>}
