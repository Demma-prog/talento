"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/" || pathname === "/login") return null;

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return <button className="back-button" onClick={goBack} aria-label="Torna indietro" title="Torna indietro"><ArrowLeft size={19}/></button>;
}
