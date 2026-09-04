import base64
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from supabase import create_client

from .auth import require_user
from .imports import _gmail_service
from .photos import BUCKET, extract_and_store_photo
from .extraction import normalize_email, normalize_phone
from .settings import settings


router = APIRouter(prefix="/candidates", tags=["candidates"])


class CandidateUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    birth_place: str | None = Field(default=None, max_length=200)
    declared_gender: str | None = None
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=60)
    city: str | None = Field(default=None, max_length=200)
    bio: str | None = Field(default=None, max_length=2000)
    job_category: str | None = None
    protected_category: bool | None = None
    missing_data_confirmed: bool | None = None
    mark_verified: bool = False


class MergeRequest(BaseModel):
    keep_id: str
    remove_id: str


@router.post("/merge")
def merge_candidates(payload: MergeRequest, user_id: str = Depends(require_user)):
    if payload.keep_id == payload.remove_id:
        raise HTTPException(status_code=422, detail="Seleziona due profili differenti")
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    rows = database.table("candidates").select("*").in_("id", [payload.keep_id, payload.remove_id]).execute().data or []
    if len(rows) != 2:
        raise HTTPException(status_code=404, detail="Uno dei candidati non esiste più")
    by_id = {row["id"]: row for row in rows}
    keep, remove = by_id[payload.keep_id], by_id[payload.remove_id]
    remove_is_newer = (remove.get("latest_cv_received_at") or "") > (keep.get("latest_cv_received_at") or "")
    if remove_is_newer:
        for table in ("experiences", "education", "skills"):
            database.table(table).delete().eq("candidate_id", payload.keep_id).execute()
            database.table(table).update({"candidate_id": payload.keep_id}).eq("candidate_id", payload.remove_id).execute()
    database.table("candidate_notes").update({"candidate_id": payload.keep_id}).eq("candidate_id", payload.remove_id).execute()
    database.table("candidate_events").update({"candidate_id": payload.keep_id}).eq("candidate_id", payload.remove_id).execute()
    source = remove if remove_is_newer else keep
    merged = {key: keep.get(key) or remove.get(key) for key in ("first_name","last_name","birth_year","birth_place","declared_gender","email","normalized_email","phone","normalized_phone","city","bio","bio_source")}
    for key in ("latest_gmail_message_id","latest_attachment_id","latest_cv_hash","latest_cv_filename","latest_cv_received_at","expires_at","extraction_confidence"):
        merged[key] = source.get(key)
    merged["needs_review"] = bool(keep.get("needs_review") or remove.get("needs_review"))
    try:
        remove_photo = database.storage.from_(BUCKET).download(f"{payload.remove_id}.webp")
        if remove_is_newer:
            try: database.storage.from_(BUCKET).remove([f"{payload.keep_id}.webp"])
            except Exception: pass
            database.storage.from_(BUCKET).upload(f"{payload.keep_id}.webp", remove_photo, {"content-type":"image/webp","upsert":"true"})
    except Exception:
        pass
    database.table("candidates").delete().eq("id", payload.remove_id).execute()
    database.table("candidates").update(merged).eq("id", payload.keep_id).execute()
    try: database.storage.from_(BUCKET).remove([f"{payload.remove_id}.webp"])
    except Exception: pass
    database.table("candidate_events").insert({"candidate_id":payload.keep_id,"actor_id":user_id,"event_type":"profiles_merged","metadata":{"removed_id":payload.remove_id}}).execute()
    return {"candidate_id": payload.keep_id}


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: str, user_id: str = Depends(require_user)):
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    exists = database.table("candidates").select("id").eq("id", candidate_id).limit(1).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Candidato non trovato")
    try:
        database.storage.from_(BUCKET).remove([f"{candidate_id}.webp"])
    except Exception:
        pass
    database.table("candidates").delete().eq("id", candidate_id).execute()
    return {"deleted": True}


@router.patch("/{candidate_id}")
def update_candidate(candidate_id: str, payload: CandidateUpdate, user_id: str = Depends(require_user)):
    _, database = _gmail_service(user_id)
    values = payload.model_dump(exclude_unset=True)
    mark_verified = values.pop("mark_verified", False)
    if values.get("declared_gender") not in (None, "female", "male", "other", "unspecified"):
        raise HTTPException(status_code=422, detail="Valore del sesso dichiarato non valido")
    if values.get("job_category") not in (None, "accounting", "logistics", "marketing", "cashier", "sales", "warehouse", "office", "other"):
        raise HTTPException(status_code=422, detail="Categoria professionale non valida")
    for key, value in list(values.items()):
        if isinstance(value, str):
            values[key] = value.strip() or None
    if "email" in values:
        values["normalized_email"] = normalize_email(values["email"])
    if "phone" in values:
        values["normalized_phone"] = normalize_phone(values["phone"])
    if mark_verified:
        values["needs_review"] = False
    result = database.table("candidates").update(values).eq("id", candidate_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidato non trovato")
    return {"candidate": result.data[0]}


@router.get("/{candidate_id}/photo")
def candidate_photo(candidate_id: str, user_id: str = Depends(require_user)):
    database = create_client(settings.supabase_url, settings.supabase_service_role_key)
    exists = database.table("candidates").select("id").eq("id", candidate_id).limit(1).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Candidato non trovato")
    try:
        data = database.storage.from_(BUCKET).download(f"{candidate_id}.webp")
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Foto non disponibile") from exc
    return Response(content=data, media_type="image/webp", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/{candidate_id}/photo/retry")
def retry_candidate_photo(candidate_id: str, user_id: str = Depends(require_user)):
    service, database = _gmail_service(user_id)
    result = database.table("candidates").select("latest_gmail_message_id,latest_attachment_id,latest_cv_filename").eq("id", candidate_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidato non trovato")
    candidate = result.data[0]
    try:
        attachment = service.users().messages().attachments().get(userId="me", messageId=candidate["latest_gmail_message_id"], id=candidate["latest_attachment_id"]).execute()
        encoded = attachment.get("data", "")
        data = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        extract_and_store_photo(database, candidate_id, data, candidate["latest_cv_filename"])
        return {"saved": True}
    except Exception as exc:
        detail = "Quota del servizio AI esaurita: riprova più tardi" if "429" in str(exc) else "Nessuna foto profilo affidabile trovata"
        raise HTTPException(status_code=422, detail=detail) from exc


@router.get("/{candidate_id}/cv")
def open_cv(candidate_id: str, user_id: str = Depends(require_user)):
    service, database = _gmail_service(user_id)
    result = database.table("candidates").select(
        "latest_gmail_message_id,latest_attachment_id,latest_cv_filename"
    ).eq("id", candidate_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Candidato non trovato")
    candidate = result.data[0]
    if not candidate.get("latest_gmail_message_id") or not candidate.get("latest_attachment_id"):
        raise HTTPException(status_code=404, detail="Curriculum non disponibile")

    attachment = service.users().messages().attachments().get(
        userId="me",
        messageId=candidate["latest_gmail_message_id"],
        id=candidate["latest_attachment_id"],
    ).execute()
    encoded = attachment.get("data", "")
    data = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
    filename = candidate.get("latest_cv_filename") or "curriculum.pdf"
    extension = filename.lower().rsplit(".", 1)[-1]
    media_types = {
        "pdf": "application/pdf",
        "doc": "application/msword",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    disposition = "inline" if extension == "pdf" else "attachment"
    return Response(
        content=data,
        media_type=media_types.get(extension, "application/octet-stream"),
        headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(filename)}"},
    )
