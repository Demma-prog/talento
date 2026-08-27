import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talento — Archivio candidati",
  description: "Gestione intelligente dei curriculum",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
