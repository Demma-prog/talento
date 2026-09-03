import argparse
import time

from supabase import create_client

from .imports import ProcessRequest, process_cv_messages
from .settings import settings


def process_cycle() -> tuple[int, int]:
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    rows = database.table("pending_cv_imports").select("requested_by,gmail_message_id").order(
        "received_at"
    ).limit(100).execute().data or []
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
    while True:
        try:
            processed, remaining = process_cycle()
            if processed or remaining:
                print(f"Elaborati: {processed} - ancora in coda: {remaining}")
        except Exception as exc:
            print(f"Controllo non riuscito: {exc}")
        if args.once:
            break
        time.sleep(max(10, args.interval))


if __name__ == "__main__":
    main()
