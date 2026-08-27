import { Bell, Search } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children, title, eyebrow, active }: { children: React.ReactNode; title: string; eyebrow?: string; active?: string }) {
  return (
    <div className="app-shell">
      <Sidebar active={active} />
      <main className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">{eyebrow ?? "Archivio candidati"}</p><h1>{title}</h1></div>
          <div className="top-actions">
            <label className="search"><Search size={17} /><input placeholder="Cerca un candidato..." /></label>
            <button className="icon-button" aria-label="Notifiche"><Bell size={19} /><span /></button>
            <div className="avatar">FG</div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
