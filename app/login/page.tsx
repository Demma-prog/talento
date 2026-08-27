"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!supabaseConfigured) { setError("Configura Supabase nel file .env.local prima di accedere."); return; }
    const form = new FormData(event.currentTarget);
    setLoading(true);
    const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    setLoading(false);
    if (authError) { setError("Email o password non corretti."); return; }
    router.replace("/"); router.refresh();
  }

  return <main className="login-page"><section className="login-visual"><div className="login-brand"><span><BriefcaseBusiness/></span>Talento</div><div><p className="eyebrow light">Archivio intelligente</p><h1>Il talento giusto,<br/>quando ti serve.</h1><p>Curriculum ordinati, profili chiari e informazioni sempre accessibili.</p></div><div className="login-orb orb-a"/><div className="login-orb orb-b"/></section><section className="login-form-wrap"><form className="login-card" onSubmit={submit}><p className="eyebrow">Area riservata</p><h2>Bentornato</h2><p>Accedi per gestire il tuo archivio candidati.</p><label>Email<div><Mail/><input name="email" type="email" required placeholder="nome@azienda.it"/></div></label><label>Password<div><LockKeyhole/><input name="password" type={showPassword?"text":"password"} required placeholder="La tua password"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label="Mostra o nascondi password">{showPassword?<EyeOff/>:<Eye/>}</button></div></label>{error&&<div className="login-error">{error}</div>}<button className="primary-button purple-button login-submit" disabled={loading}>{loading?<><LoaderCircle className="spin"/>Accesso...</>:"Accedi"}</button><small>Accesso consentito esclusivamente agli utenti autorizzati.</small></form></section></main>;
}
