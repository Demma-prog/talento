import base64
import hashlib
from datetime import date, datetime, timedelta, timezone
from email.utils import parseaddr

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from pydantic import BaseModel, Field
from supabase import create_client

from .auth import require_user
from .extraction import CandidateExtraction, extract_candidate, normalize_email, normalize_phone
from .photos import extract_and_store_photo
from .settings import settings


router = APIRouter(prefix="/imports", tags=["imports"])
CV_QUERY = "has:attachment {filename:pdf filename:doc filename:docx}"
CV_EXTENSIONS = (".pdf", ".doc", ".docx")


class ImportRequest(BaseModel):
    max_messages: int = Field(default=10, ge=1, le=20)


class ProcessRequest(BaseModel):
    message_ids: list[str] = Field(min_length=1, max_length=3)


def _header(headers: list[dict], name: str) -> str:
    wanted = name.lower()
    return next((item.get("value", "") for item in headers if item.get("name", "").lower() == wanted), "")


def _attachments(part: dict) -> list[dict]:
    found = []
    filename = part.get("filename", "")
    body = part.get("body", {})
    if filename.lower().endswith(CV_EXTENSIONS) and body.get("attachmentId"):
        found.append({"filename": filename, "attachment_id": body["attachmentId"]})
    for child in part.get("parts", []):
        found.extend(_attachments(child))
    return found


def _gmail_service(user_id: str):
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    result = database.table("gmail_connections").select("encrypted_refresh_token").eq("user_id", user_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=409, detail="Collega prima la casella Gmail dalle Impostazioni")

    refresh_token = Fernet(settings.gmail_token_encryption_key.encode()).decrypt(
        result.data[0]["encrypted_refresh_token"].encode()
    ).decode()
    credentials = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    )
    credentials.refresh(Request())
    return build("gmail", "v1", credentials=credentials, cache_discovery=False), database


def _safe_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        return None


def _find_candidate(database, extracted: CandidateExtraction, sender: str):
    email = normalize_email(extracted.email) or normalize_email(parseaddr(sender)[1])
    phone = normalize_phone(extracted.phone)
    if email:
        result = database.table("candidates").select("*").eq("normalized_email", email).limit(1).execute()
        if result.data:
            return result.data[0], email, phone
    if phone:
        result = database.table("candidates").select("*").eq("normalized_phone", phone).limit(1).execute()
        if result.data:
            return result.data[0], email, phone
    if extracted.birth_year:
        result = database.table("candidates").select("*").ilike("first_name", extracted.first_name.strip()).ilike("last_name", extracted.last_name.strip()).eq("birth_year", extracted.birth_year).limit(1).execute()
        if result.data:
            return result.data[0], email, phone
    return None, email, phone


def _save_sections(database, candidate_id: str, extracted: CandidateExtraction):
    for table in ("experiences", "education", "skills"):
        database.table(table).delete().eq("candidate_id", candidate_id).execute()
    if extracted.experiences:
        database.table("experiences").insert([{
            "candidate_id": candidate_id, "company": row.company, "role": row.role,
            "location": row.location, "start_date": _safe_date(row.start_date),
            "end_date": _safe_date(row.end_date), "is_current": row.is_current,
            "description": row.description, "sort_order": index,
        } for index, row in enumerate(extracted.experiences)]).execute()
    if extracted.education:
        database.table("education").insert([{
            "candidate_id": candidate_id, "institution": row.institution,
            "qualification": row.qualification, "field_of_study": row.field_of_study,
            "start_year": row.start_year, "end_year": row.end_year, "sort_order": index,
        } for index, row in enumerate(extracted.education)]).execute()
    if extracted.skills:
        database.table("skills").insert([{
            "candidate_id": candidate_id, "name": row.name,
            "category": row.category, "level": row.level,
        } for row in extracted.skills]).execute()


def _process_attachment(service, database, message: dict, attachment: dict):
    message_id = message["id"]
    already = database.table("candidates").select("id").eq("latest_gmail_message_id", message_id).limit(1).execute()
    if already.data:
        return "duplicate", None

    encoded = service.users().messages().attachments().get(
        userId="me", messageId=message_id, id=attachment["attachment_id"]
    ).execute().get("data", "")
    data = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    extracted = extract_candidate(data, attachment["filename"])
    headers = message.get("payload", {}).get("headers", [])
    sender = _header(headers, "From")
    existing, email, phone = _find_candidate(database, extracted, sender)
    received = datetime.fromtimestamp(int(message.get("internalDate", "0")) / 1000, tz=timezone.utc)
    if existing and existing.get("latest_cv_received_at"):
        previous = datetime.fromisoformat(existing["latest_cv_received_at"].replace("Z", "+00:00"))
        if received <= previous:
            return "duplicate", existing["id"]

    candidate = {
        "first_name": extracted.first_name.strip(), "last_name": extracted.last_name.strip(),
        "birth_year": extracted.birth_year, "birth_place": extracted.birth_place,
        "declared_gender": extracted.declared_gender, "email": extracted.email or parseaddr(sender)[1] or None,
        "normalized_email": email, "phone": extracted.phone, "normalized_phone": phone,
        "city": extracted.city, "bio": extracted.bio,
        "bio_source": "ai_summary" if extracted.bio else None,
        "latest_gmail_message_id": message_id,
        "latest_attachment_id": attachment["attachment_id"],
        "latest_cv_hash": hashlib.sha256(data).hexdigest(),
        "latest_cv_filename": attachment["filename"],
        "latest_cv_received_at": received.isoformat(),
        "expires_at": (received + timedelta(days=365)).isoformat(),
        "extraction_confidence": extracted.confidence,
        "needs_review": extracted.confidence < 0.75 or not email,
    }
    if existing:
        saved = database.table("candidates").update(candidate).eq("id", existing["id"]).execute()
        candidate_id, outcome = existing["id"], "updated"
    else:
        saved = database.table("candidates").insert(candidate).execute()
        candidate_id, outcome = saved.data[0]["id"], "imported"
    _save_sections(database, candidate_id, extracted)
    try:
        extract_and_store_photo(database, candidate_id, data, attachment["filename"])
    except Exception:
        pass
    return outcome, candidate_id


@router.post("")
def scan_cv_messages(payload: ImportRequest, user_id: str = Depends(require_user)):
    service, database = _gmail_service(user_id)
    run = database.table("import_runs").insert({"requested_by": user_id, "status": "running"}).execute()
    run_id = run.data[0]["id"] if run.data else None

    try:
        listing = service.users().messages().list(
            userId="me", q=CV_QUERY, maxResults=payload.max_messages
        ).execute()
        previews = []
        for item in listing.get("messages", []):
            message = service.users().messages().get(userId="me", id=item["id"], format="full").execute()
            headers = message.get("payload", {}).get("headers", [])
            attachments = _attachments(message.get("payload", {}))
            if not attachments:
                continue
            previews.append({
                "message_id": item["id"],
                "subject": _header(headers, "Subject") or "Senza oggetto",
                "sender": _header(headers, "From"),
                "received_at": datetime.fromtimestamp(
                    int(message.get("internalDate", "0")) / 1000, tz=timezone.utc
                ).isoformat(),
                "attachments": [{"filename": attachment["filename"]} for attachment in attachments],
            })

        if run_id:
            database.table("import_runs").update({
                "status": "scanned",
                "found_count": len(previews),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()
        return {
            "status": "scanned",
            "run_id": run_id,
            "found_count": len(previews),
            "messages": previews,
            "message": "Scansione Gmail completata. Nessun CV è stato ancora inviato a Gemini.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        if run_id:
            database.table("import_runs").update({
                "status": "failed", "failed_count": 1,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()
        raise HTTPException(status_code=502, detail="Scansione Gmail non riuscita") from exc


@router.post("/process")
def process_cv_messages(payload: ProcessRequest, user_id: str = Depends(require_user)):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="Gemini non configurato")
    service, database = _gmail_service(user_id)
    run = database.table("import_runs").insert({"requested_by": user_id, "status": "running"}).execute()
    run_id = run.data[0]["id"] if run.data else None
    counts = {"imported": 0, "updated": 0, "duplicate": 0, "failed": 0}
    candidates = []
    errors = []
    for message_id in payload.message_ids:
        try:
            message = service.users().messages().get(userId="me", id=message_id, format="full").execute()
            attachments = _attachments(message.get("payload", {}))
            for attachment in attachments:
                try:
                    outcome, candidate_id = _process_attachment(service, database, message, attachment)
                    counts[outcome] += 1
                    if candidate_id:
                        candidates.append(candidate_id)
                except Exception:
                    counts["failed"] += 1
                    errors.append(attachment["filename"])
        except Exception:
            counts["failed"] += 1
            errors.append(message_id)

    if run_id:
        database.table("import_runs").update({
            "status": "completed" if not counts["failed"] else "completed_with_errors",
            "found_count": len(payload.message_ids), "imported_count": counts["imported"],
            "updated_count": counts["updated"], "duplicate_count": counts["duplicate"],
            "failed_count": counts["failed"], "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()
    return {"status": "completed", **counts, "candidate_ids": candidates, "errors": errors}
