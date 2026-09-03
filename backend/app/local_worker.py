import argparse
import json
import threading
import time
from datetime import datetime, timezone

from supabase import create_client

from .imports import CV_QUERY, ProcessRequest, _attachments, _choose_cv_attachment, _gmail_service, _queue_cv, process_cv_messages
from .settings import settings


def advance_import_job() -> bool:
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    jobs = database.table("import_runs").select("*").in_("status", ["background_requested", "background_running"]).order("created_at").limit(1).execute().data or []
    if not jobs:
        return False
    job = jobs[0]
    try:
        cursor = json.loads(job.get("gmail_cursor") or "{}")
        service, database = _gmail_service(job["requested_by"])
        query = CV_QUERY
        if cursor.get("after_epoch"):
            query += f" after:{cursor['after_epoch']}"
        request = {"userId":"me", "q":query, "maxResults":10}
        if cursor.get("page_token"):
            request["pageToken"] = cursor["page_token"]
        listing = service.users().messages().list(**request).execute()
        queued = 0
        duplicates = 0
        for item in listing.get("messages", []):
            known = database.table("candidates").select("id").eq("latest_gmail_message_id", item["id"]).limit(1).execute().data
            if known:
                duplicates += 1
                continue
            message = service.users().messages().get(userId="me", id=item["id"], format="full").execute()
            attachment = _choose_cv_attachment(_attachments(message.get("payload", {})))
            if attachment:
                _queue_cv(database, job["requested_by"], message, attachment)
                queued += 1
        next_page = listing.get("nextPageToken")
        scanned = (job.get("found_count") or 0) + len(listing.get("messages", []))
        total = cursor.get("estimated_total") or listing.get("resultSizeEstimate") or scanned
        progress = {"page_token":next_page, "after_epoch":cursor.get("after_epoch"), "estimated_total":max(total, scanned), "last_batch_queued":queued}
        values = {
            "status":"background_running" if next_page else "background_completed",
            "gmail_cursor":json.dumps(progress), "found_count":scanned,
            "duplicate_count":(job.get("duplicate_count") or 0)+duplicates,
        }
        if not next_page:
            values["completed_at"] = datetime.now(timezone.utc).isoformat()
        database.table("import_runs").update(values).eq("id", job["id"]).execute()
        return True
    except Exception:
        database.table("import_runs").update({"status":"background_failed","failed_count":1,"completed_at":datetime.now(timezone.utc).isoformat()}).eq("id", job["id"]).execute()
        return False


def process_cycle() -> tuple[int, int]:
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    rows = database.table("pending_cv_imports").select("requested_by,gmail_message_id").order(
        "received_at"
    ).limit(3).execute().data or []
    processed = 0
    remaining = len(rows)
    by_user: dict[str, list[str]] = {}
    for row in rows:
        by_user.setdefault(row["requested_by"], []).append(row["gmail_message_id"])
    for user_id, message_ids in by_user.items():
        for offset in range(0, len(message_ids), 3):
            result = process_cv_messages(ProcessRequest(message_ids=message_ids[offset:offset + 3]), user_id)
            completed = result["imported"] + result["updated"] + result["duplicate"]
            processed += completed
            remaining -= completed
            if not completed:
                return processed, max(remaining, 0)
    return processed, max(remaining, 0)


def main() -> None:
    parser = argparse.ArgumentParser(description="Elabora con Qwen i CV accodati da Talento")
    parser.add_argument("--once", action="store_true", help="Esegue un solo controllo e termina")
    parser.add_argument("--interval", type=int, default=30, help="Secondi fra i controlli della coda")
    args = parser.parse_args()
    if settings.ai_provider.lower() != "ollama":
        raise SystemExit("Impostare AI_PROVIDER=ollama prima di avviare il lavoratore locale")
    print(f"Talento local worker avviato - modello {settings.ollama_model}")
    if args.once:
        advance_import_job()
        processed, remaining = process_cycle()
        if processed or remaining: print(f"Elaborati: {processed} - ancora in coda: {remaining}")
        return

    def import_loop():
        while True:
            try: worked = advance_import_job()
            except Exception as exc:
                print(f"Importazione non riuscita: {exc}"); worked = False
            time.sleep(0.5 if worked else max(10, args.interval))

    def analysis_loop():
        while True:
            try:
                processed, remaining = process_cycle()
                if processed or remaining: print(f"Elaborati: {processed} - ancora in coda: {remaining}")
            except Exception as exc: print(f"Analisi non riuscita: {exc}"); processed = 0
            if not processed: time.sleep(max(10, args.interval))

    threads=[threading.Thread(target=import_loop,daemon=True),threading.Thread(target=analysis_loop,daemon=True)]
    for thread in threads: thread.start()
    for thread in threads: thread.join()


if __name__ == "__main__":
    main()
