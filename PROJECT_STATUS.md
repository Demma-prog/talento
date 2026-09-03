# Stato del progetto Talento

Ultimo aggiornamento: 3 settembre 2026

## Obiettivo

Catalogare automaticamente i curriculum ricevuti nella casella Gmail dedicata, mantenendo una sola
scheda aggiornata per candidato. I dati strutturati sono conservati su Supabase, mentre i CV originali
restano collegati agli allegati Gmail. La conservazione prevista è di 365 giorni.

## Architettura attuale

- Interfaccia Next.js pubblicata su Vercel: `https://talento-kappa.vercel.app`
- API FastAPI pubblicata su Render: `https://talento-import-api-9ek9.onrender.com`
- Database e fotografie: Supabase
- Documenti originali: allegati Gmail
- Estrazione AI: Qwen 3 4B tramite Ollama sul PC
- Repository: `https://github.com/Demma-prog/talento.git`

Render acquisisce i riferimenti dei nuovi CV e li inserisce nella coda. Il worker eseguito sul PC
scarica gli allegati da Gmail, li analizza con Qwen e aggiorna Supabase. Render non può collegarsi
direttamente a Ollama tramite `localhost`.

## Funzioni completate

- Accesso autenticato all'applicazione.
- Collegamento OAuth alla casella Gmail dedicata.
- Scansione limitata alle email dal 1° gennaio dell'anno corrente.
- Conteggio preventivo delle email e stima dei tempi.
- Importazione automatica in pagine da 10 email e analisi in gruppi da 3 CV.
- Checkpoint per riprendere l'importazione senza ricominciare l'archivio da zero.
- Coda “Da elaborare” quando il motore AI non è disponibile.
- Worker locale Qwen per elaborare automaticamente la coda.
- Navigazione laterale immediata: l'animazione non ritarda più il cambio pagina.
- Supporto PDF, DOCX e DOC; l'analisi locale diretta supporta PDF e DOCX.
- Estrazione di dati personali, bio, esperienze, istruzione e competenze.
- Recupero locale delle fotografie incorporate nei PDF e DOCX.
- Un solo profilo per persona, aggiornato con il CV più recente.
- Apertura autenticata del CV originale.
- Modifica manuale dei dati del candidato.
- Note interne e gestione dello stato della candidatura.
- Rilevamento e unione controllata dei possibili duplicati.
- Badge dinamici per duplicati, dati incompleti e CV da elaborare.
- Categorie professionali: Contabilità, Logistica, Marketing, Cassiere/a, Commesso/a,
  Magazzino, Ufficio e Altro.
- Categoria principale modificabile manualmente.
- Filtro per età, sesso dichiarato, città, categoria, esperienza, stato, dati da verificare
  e appartenenza dichiarata alle categorie protette.
- Eliminazione e scadenza automatica dopo 365 giorni.

## Configurazione applicata

- Migrazioni Supabase `001`, `002` e `003` applicate.
- Tabella `pending_cv_imports` disponibile.
- Colonne `job_category` e `protected_category` disponibili sui candidati.
- Modello Ollama installato: `qwen3:4b`.
- Worker locale avviato manualmente in background il 3 settembre 2026.
- Ultimo commit pubblicato: `9390eec` (`Clarify deferred local Qwen processing`).

## Aspetti da collaudare

- Apertura di PDF, DOC e DOCX dall'applicazione pubblicata.
- Salvataggio delle correzioni manuali su un candidato reale.
- Precisione delle nuove categorie su un campione rappresentativo.
- Recupero fotografie su differenti modelli di curriculum.
- Elaborazione completa della coda con Qwen e controllo dei tempi medi.
- Aggiornamento immediato dei badge dopo modifiche, unioni e nuove importazioni.
- Persistenza dell'importazione quando l'utente lascia la pagina Importa CV.

## Prossimi interventi

1. Spostare il coordinamento dell'importazione dalla pagina a un processo persistente, così può
   continuare mentre l'utente consulta le altre sezioni.
2. Completare il collaudo autenticato delle funzioni pubblicate.
3. Configurare l'avvio automatico del worker Qwen con Windows.
4. Rendere visibile nell'interfaccia lo stato del worker locale.
5. Valutare la qualità di Qwen sui CV reali e affinare prompt e classificazione.

## Regola di manutenzione

Questo file va aggiornato dopo ogni modifica significativa a funzioni, infrastruttura, configurazione,
deployment o problemi conosciuti. Non deve contenere password, token, chiavi API o altri segreti.
