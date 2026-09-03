"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CSSProperties, MouseEvent, useEffect, useState } from "react";
import { BriefcaseBusiness, CircleUserRound, Clock3, FileSearch, LayoutDashboard, ListRestart, Settings, Sparkles, UserRoundSearch } from "lucide-react";
import { PlantIllustration } from "./PlantIllustration";

const items = [
  ["Dashboard", "/", LayoutDashboard],
  ["Candidati", "/candidati", CircleUserRound],
  ["Importa CV", "/importa", Sparkles],
  ["Da elaborare", "/da-elaborare", ListRestart],
  ["Possibili duplicati", "/duplicati", UserRoundSearch],
  ["Dati incompleti", "/incompleti", FileSearch],
  ["CV in scadenza", "/scadenze", Clock3],
  ["Impostazioni", "/impostazioni", Settings],
] as const;

export function Sidebar({ active: activeFallback = "Dashboard" }: { active?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  const [counts,setCounts]=useState({duplicates:0,incomplete:0,pending:0});
  const active = items.find(([, href]) => href === "/" ? pathname === "/" : pathname.startsWith(href))?.[0] ?? activeFallback;
  const targetIndex = target ? items.findIndex(([, href]) => href === target) : -1;
  const activeIndex = items.findIndex(([label]) => label === active);
  const displayedIndex = targetIndex >= 0 ? targetIndex : Math.max(activeIndex, 0);
  const highlightedLabel = targetIndex >= 0 ? items[targetIndex][0] : active;
  const ActiveIcon = items[displayedIndex][2];
  const dropletStyle = { "--drop-index": displayedIndex } as CSSProperties;

  useEffect(() => {
    setTarget(null);
  }, [pathname]);

  useEffect(()=>{
    let mounted=true;
    fetch("/api/navigation-counts",{cache:"no-store"}).then(response=>response.ok?response.json():null).then(data=>{
      if(mounted&&data)setCounts(data);
    }).catch(()=>{});
    return()=>{mounted=false};
  },[pathname]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (href === pathname || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (target) return;
    setTarget(href);
    window.requestAnimationFrame(() => router.push(href));
  }

  return (
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><BriefcaseBusiness size={20} /></span><span>Talento</span></Link>
      <nav className="side-nav" aria-label="Navigazione principale">
        <span className={`nav-droplet ${target ? "travelling" : ""}`} style={dropletStyle} aria-hidden="true"><ActiveIcon size={20} strokeWidth={2} /></span>
        {items.map(([label, href, Icon]) => (
          <Link key={label} href={href} onClick={(event) => navigate(event, href)} aria-current={active === label ? "page" : undefined} className={`nav-item ${highlightedLabel === label ? "active" : ""}`}>
            <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
            {label === "Possibili duplicati" && counts.duplicates>0 && <em>{counts.duplicates}</em>}
            {label === "Dati incompleti" && counts.incomplete>0 && <em>{counts.incomplete}</em>}
            {label === "Da elaborare" && counts.pending>0 && <em>{counts.pending}</em>}
          </Link>
        ))}
      </nav>
      <div className="plant-wrap"><PlantIllustration /></div>
      <div className="sidebar-foot"><span className="status-dot" /> Sistema pronto</div>
    </aside>
  );
}
