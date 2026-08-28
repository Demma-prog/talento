import base64
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from .auth import require_user
from .imports import _gmail_service
from .photos import BUCKET


router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("/{candidate_id}/photo")
def candidate_photo(candidate_id: str, user_id: str = Depends(require_user)):
    _, database = _gmail_service(user_id)
    exists = database.table("candidates").select("id").eq("id", candidate_id).limit(1).execute()
    if not exists.data:
        raise HTTPException(status_code=404, detail="Candidato non trovato")
    try:
        data = database.storage.from_(BUCKET).download(f"{candidate_id}.webp")
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Foto non disponibile") from exc
    return Response(content=data, media_type="image/webp", headers={"Cache-Control": "private, max-age=3600"})


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
