# Talento

Gestionale leggero per importare curriculum da Gmail, estrarre dati strutturati e gestire una sola scheda aggiornata per candidato.

## Funzioni disponibili

- importazione Gmail manuale, incrementale e riprendibile tramite checkpoint;
- analisi strutturata locale con Qwen 3 4B di dati personali, bio, esperienze, istruzione e competenze;
- un solo profilo per persona, aggiornato con il CV più recente;
- fotografie estratte dai PDF/DOCX e archiviate nel bucket privato Supabase;
- CV aperti direttamente dall'allegato originale Gmail;
- filtri per età, sesso dichiarato, città, categoria professionale, esperienza, stato e categoria protetta;
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

1. Creare il progetto Supabase ed eseguire, in ordine, i file in `supabase/migrations/`.
2. Copiare `.env.example` in `.env.local` per il frontend e configurare i secret su Render.
3. Creare credenziali OAuth Gmail con ambito `gmail.readonly`. Le email originali non vengono eliminate.
4. Installare Ollama sul PC e rendere disponibile il modello indicato da `OLLAMA_MODEL`.

La service-role key Supabase e i token Gmail non devono mai essere inseriti nel frontend o nel repository.

### Elaborazione locale opzionale

Talento usa un modello locale tramite Ollama. Avviare il backend sullo stesso PC di Ollama e impostare:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
```

Il backend pubblicato su Render non può raggiungere Ollama in esecuzione sul PC: acquisisce quindi
i riferimenti dei CV nella coda “Da elaborare”, che viene poi smaltita dal backend avviato localmente.

Con Ollama già avviato, il lavoratore locale può controllare e svuotare automaticamente la coda:

```bash
cd backend
.venv/Scripts/python -m app.local_worker
```

Usare `--once` per eseguire un solo controllo. Il processo continuo verifica la coda ogni 30 secondi.
