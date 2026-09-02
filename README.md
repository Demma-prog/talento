# Talento

Gestionale leggero per importare curriculum da Gmail, estrarre dati strutturati e gestire una sola scheda aggiornata per candidato.

## Funzioni disponibili

- importazione Gmail manuale, incrementale e riprendibile tramite checkpoint;
- analisi strutturata con Gemini di dati personali, bio, esperienze, istruzione e competenze;
- un solo profilo per persona, aggiornato con il CV più recente;
- fotografie estratte dai PDF/DOCX e archiviate nel bucket privato Supabase;
- CV aperti direttamente dall'allegato originale Gmail;
- filtri per età, sesso dichiarato, città, profilo, settore, esperienza e stato;
- correzione manuale di dati personali e sezioni del curriculum;
- note interne, stato candidatura, possibili duplicati e unione controllata;
- eliminazione manuale e conservazione automatica per 365 giorni;
- elenco dei CV in scadenza e segnalazione leggibile degli errori di importazione.

## Struttura

- `app/`, `components/`: interfaccia Next.js destinata a Vercel
- `backend/`: API FastAPI destinata a Render
- `supabase/migrations/`: schema PostgreSQL e policy RLS

## Avvio interfaccia

```bash
npm install
npm run dev
```

Aprire `http://localhost:3000`. È necessario configurare Supabase per accedere all'archivio.

## Avvio backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload
```

## Configurazione

1. Creare il progetto Supabase ed eseguire `supabase/migrations/001_initial_schema.sql`.
2. Copiare `.env.example` in `.env.local` per il frontend e configurare i secret su Render.
3. Creare credenziali OAuth Gmail con ambito `gmail.readonly`. Le email originali non vengono eliminate.
4. Creare una chiave Gemini e impostare `GEMINI_API_KEY` esclusivamente sul backend.

La service-role key Supabase e i token Gmail non devono mai essere inseriti nel frontend o nel repository.
