import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type CandidateListItem = {
  id: string;
  initials: string;
  name: string;
  role: string;
  city: string;
  status: string;
  receivedAt: string;
};

const demoCandidates: CandidateListItem[] = [
  { id: "martina-russo", initials: "MR", name: "Martina Russo", role: "Addetta vendite", city: "Milano", status: "Da contattare", receivedAt: "27 ago 2026" },
  { id: "luca-conti", initials: "LC", name: "Luca Conti", role: "Store manager", city: "Monza", status: "Da verificare", receivedAt: "26 ago 2026" },
  { id: "giulia-serra", initials: "GS", name: "Giulia Serra", role: "Visual merchandiser", city: "Bergamo", status: "Contattato", receivedAt: "24 ago 2026" },
  { id: "andrea-moretti", initials: "AM", name: "Andrea Moretti", role: "Addetto magazzino", city: "Milano", status: "Mai contattato", receivedAt: "23 ago 2026" },
  { id: "elena-ferri", initials: "EF", name: "Elena Ferri", role: "Sales assistant", city: "Como", status: "Colloquio programmato", receivedAt: "21 ago 2026" },
];

const statusLabels: Record<string, string> = {
  never_contacted: "Mai contattato", to_contact: "Da contattare", contacted: "Contattato",
  interview_scheduled: "Colloquio programmato", accepted: "Accettato",
  rejected_after_contact: "Rifiutato dopo il contatto", rejected_directly: "Rifiutato direttamente",
  unavailable: "Non disponibile", reconsider: "Da rivalutare",
};

export async function getCandidates(): Promise<{ data: CandidateListItem[]; demo: boolean }> {
  if (!supabaseConfigured) return { data: demoCandidates, demo: true };
  const supabase = await createClient();
  const { data, error } = await supabase.from("candidates").select("id,first_name,last_name,city,status,latest_cv_received_at,experiences(role,sort_order)").order("latest_cv_received_at", { ascending: false });
  if (error) throw new Error(`Impossibile caricare i candidati: ${error.message}`);
  return {
    demo: false,
    data: (data ?? []).map((row) => {
      const experiences = Array.isArray(row.experiences) ? [...row.experiences].sort((a, b) => a.sort_order - b.sort_order) : [];
      const date = row.latest_cv_received_at ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(row.latest_cv_received_at)) : "—";
      return { id: row.id, initials: `${row.first_name?.[0] ?? ""}${row.last_name?.[0] ?? ""}`.toUpperCase(), name: `${row.first_name} ${row.last_name}`, role: experiences[0]?.role ?? "Profilo da definire", city: row.city ?? "—", status: statusLabels[row.status] ?? row.status, receivedAt: date };
    }),
  };
}
