import base64

from app.imports import _gmail_service
from app.photos import extract_and_store_photo
from app.settings import settings
from supabase import create_client


database = create_client(settings.supabase_url, settings.supabase_service_role_key)
connections = database.table("gmail_connections").select("user_id").limit(1).execute().data
if not connections:
    raise SystemExit("Gmail non collegato")
service, database = _gmail_service(connections[0]["user_id"])
candidates = database.table("candidates").select(
    "id,latest_gmail_message_id,latest_attachment_id,latest_cv_filename"
).execute().data or []
found = 0
missing = 0
errors = {}
for candidate in candidates:
    try:
        attachment = service.users().messages().attachments().get(
            userId="me",
            messageId=candidate["latest_gmail_message_id"],
            id=candidate["latest_attachment_id"],
        ).execute()
        encoded = attachment.get("data", "")
        data = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        extract_and_store_photo(database, candidate["id"], data, candidate["latest_cv_filename"])
        found += 1
    except Exception as exc:
        missing += 1
        key = f"{type(exc).__name__}: {str(exc)[:160]}"
        errors[key] = errors.get(key, 0) + 1
print(f"FOTO_ESTRATTE: {found}")
print(f"SENZA_FOTO_AFFIDABILE: {missing}")
for error, count in errors.items():
    print(f"ERRORE ({count}): {error}")
