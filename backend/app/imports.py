import base64
import hashlib
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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
from .photos import extract_and_store_photo_from_cv_result
from .retention import cleanup_expired_candidates
from .settings import settings


router = APIRouter(prefix="/imports", tags=["imports"])
logger = logging.getLogger(__name__)
CV_QUERY = "has:attachment {filename:pdf filename:doc filename:docx}"
CV_EXTENSIONS = (".pdf", ".doc", ".docx")

def _friendly_error(exc: Exception) -> str:
    message = str(exc).lower()
    if "429" in message or "quota" in message or "resource_exhausted" in message: return "Quota gratuita Gemini esaurita: riprova dopo il rinnovo"
    if "doc meno recenti" in message: return "Formato DOC non supportato: convertire in PDF o DOCX"
    return "Analisi non riuscita; il CV potrà essere ritentato"


class ImportRequest(BaseModel):
    max_messages: int = Field(default=10, ge=1, le=20)
    page_token: str | None = None
    after_epoch: int | None = None


class ProcessRequest(BaseModel):
    message_ids: list[str] = Field(min_length=1, max_length=3)


class CheckpointRequest(BaseModel):
    next_page_token: str | None = None
    after_epoch: int | None = None
    processed_count: int = Field(default=0, ge=0)
    complete: bool = False


def _header(headers: list[dict], name: str) -> str:
    wanted = name.lower()
    return next((item.get("value", "") for item in headers if item.get("name", "").lower() == wanted), "")


def _attachments(part: dict) -> list[dict]:
    found = []
    filename = part.get("filename", "")
    body = part.get("body", {})
    if filename.lower().endswith(CV_EXTENSIONS) and body.get("attachmentId"):
        found.append({"filename": filename, "attachment_id": body["attachmentId"], "size": body.get("size", 0)})
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


def _choose_cv_attachment(attachments: list[dict]) -> dict | None:
    if not attachments:
        return None
    def score(item: dict):
        name = item["filename"].lower()
        hint = 2 if "curriculum" in name else 1 if "cv" in name else 0
        return hint, item.get("size", 0)
    return max(attachments, key=score)


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


def _process_attachment_data(database, message: dict, attachment: dict, data: bytes):
    message_id = message["id"]
    already = database.table("candidates").select("id").eq("latest_gmail_message_id", message_id).limit(1).execute()
    if already.data:
        return "duplicate", None

    extracted = _extract_candidate_with_retry(data, attachment["filename"])
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
        extract_and_store_photo_from_cv_result(database, candidate_id, data, attachment["filename"], extracted)
    except Exception:
        pass
    return outcome, candidate_id


def _extract_candidate_with_retry(data: bytes, filename: str) -> CandidateExtraction:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            return extract_candidate(data, filename)
        except Exception as exc:
            last_error = exc
            logger.warning(
                "Gemini analysis failed for %s (attempt %s/3): %s: %s",
                filename,
                attempt + 1,
                type(exc).__name__,
                exc,
            )
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    assert last_error is not None
    raise last_error


def _process_attachment(service, database, message: dict, attachment: dict):
    encoded = service.users().messages().attachments().get(
        userId="me", messageId=message["id"], id=attachment["attachment_id"]
    ).execute().get("data", "")
    data = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    return _process_attachment_data(database, message, attachment, data)


def _process_downloaded(message: dict, attachment: dict, data: bytes):
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _process_attachment_data(database, message, attachment, data)


@router.post("/position")
def import_position(user_id: str = Depends(require_user)):
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    result = database.table("import_runs").select(
        "status,gmail_cursor,completed_at"
    ).eq("requested_by", user_id).in_(
        "status", ["archive_checkpoint", "archive_complete"]
    ).order("created_at", desc=True).limit(1).execute()
    if not result.data:
        return {"mode": "archive", "page_token": None, "after_epoch": None}
    latest = result.data[0]
    if latest["status"] == "archive_checkpoint":
        try:
            cursor = json.loads(latest.get("gmail_cursor") or "{}")
        except json.JSONDecodeError:
            cursor = {"page_token": latest.get("gmail_cursor"), "after_epoch": None}
        return {"mode": "resume", "page_token": cursor.get("page_token"), "after_epoch": cursor.get("after_epoch")}
    completed = datetime.fromisoformat(latest["completed_at"].replace("Z", "+00:00"))
    return {
        "mode": "incremental", "page_token": None,
        "after_epoch": max(0, int(completed.timestamp()) - 86400),
    }


@router.post("/checkpoint")
def save_checkpoint(payload: CheckpointRequest, user_id: str = Depends(require_user)):
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    now = datetime.now(timezone.utc).isoformat()
    database.table("import_runs").insert({
        "requested_by": user_id,
        "status": "archive_complete" if payload.complete else "archive_checkpoint",
        "gmail_cursor": json.dumps({
            "page_token": payload.next_page_token,
            "after_epoch": payload.after_epoch,
        }),
        "found_count": payload.processed_count,
        "completed_at": now,
    }).execute()
    return {"saved": True, "complete": payload.complete}


@router.post("")
def scan_cv_messages(payload: ImportRequest, user_id: str = Depends(require_user)):
    service, database = _gmail_service(user_id)
    expired_removed = cleanup_expired_candidates(database)
    run = database.table("import_runs").insert({"requested_by": user_id, "status": "running"}).execute()
    run_id = run.data[0]["id"] if run.data else None

    try:
        query = CV_QUERY
        if payload.after_epoch:
            query += f" after:{payload.after_epoch}"
        request = {"userId": "me", "q": query, "maxResults": payload.max_messages}
        if payload.page_token:
            request["pageToken"] = payload.page_token
        listing = service.users().messages().list(**request).execute()
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

        next_page_token = listing.get("nextPageToken")
        if run_id:
            database.table("import_runs").update({
                "status": "scanned",
                "found_count": len(previews),
                "gmail_cursor": next_page_token,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()
        return {
            "status": "scanned",
            "run_id": run_id,
            "found_count": len(previews),
            "messages": previews,
            "next_page_token": next_page_token,
            "has_more": bool(next_page_token),
            "estimated_total": listing.get("resultSizeEstimate", len(previews)),
            "expired_removed": expired_removed,
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
    prepared = []
    for message_id in payload.message_ids:
        try:
            message = service.users().messages().get(userId="me", id=message_id, format="full").execute()
            attachment = _choose_cv_attachment(_attachments(message.get("payload", {})))
            if not attachment:
                raise ValueError("Nessun allegato CV")
            encoded = service.users().messages().attachments().get(
                userId="me", messageId=message_id, id=attachment["attachment_id"]
            ).execute().get("data", "")
            data = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
            prepared.append((message, attachment, data))
        except Exception as exc:
            counts["failed"] += 1
            errors.append(f"Email {message_id}: {_friendly_error(exc)}")

    # Two concurrent multimodal PDF requests fit more reliably in Render's
    # free instance memory and Gemini's free-tier burst limits.
    with ThreadPoolExecutor(max_workers=min(2, len(prepared)) or 1) as executor:
        futures = {
            executor.submit(_process_downloaded, message, attachment, data): attachment
            for message, attachment, data in prepared
        }
        for future in as_completed(futures):
            attachment = futures[future]
            try:
                outcome, candidate_id = future.result()
                counts[outcome] += 1
                if candidate_id:
                    candidates.append(candidate_id)
            except Exception as exc:
                counts["failed"] += 1
                errors.append(f"{attachment['filename']}: {_friendly_error(exc)}")

    if run_id:
        database.table("import_runs").update({
            "status": "completed" if not counts["failed"] else "completed_with_errors",
            "found_count": len(payload.message_ids), "imported_count": counts["imported"],
            "updated_count": counts["updated"], "duplicate_count": counts["duplicate"],
            "failed_count": counts["failed"], "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()
    return {"status": "completed", **counts, "candidate_ids": candidates, "errors": errors}
