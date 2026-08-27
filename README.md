# Talento

Gestionale leggero per importare curriculum da Gmail, estrarre dati strutturati e gestire una sola scheda aggiornata per candidato.

## Struttura

- `app/`, `components/`: interfaccia Next.js destinata a Vercel
- `backend/`: API FastAPI destinata a Render
- `supabase/migrations/`: schema PostgreSQL e policy RLS

## Avvio interfaccia

```bash
npm install
npm run dev
```

Aprire `http://localhost:3000`. La UI usa dati dimostrativi finché Supabase non viene configurato.

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
3. Creare credenziali OAuth Gmail in sola lettura più permesso di modifica solo se si abilita la cancellazione delle email scadute.
4. Creare una chiave Gemini e impostare `GEMINI_API_KEY` esclusivamente sul backend.

La service-role key Supabase e i token Gmail non devono mai essere inseriti nel frontend o nel repository.
