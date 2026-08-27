from fastapi import Header, HTTPException
from supabase import create_client
from .settings import settings

async def require_user(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Autenticazione richiesta")
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=503, detail="Supabase backend non configurato")
    jwt = authorization.split(" ", 1)[1]
    try:
        result = create_client(settings.supabase_url, settings.supabase_service_role_key).auth.get_user(jwt)
        if not result.user: raise ValueError("Utente assente")
        return str(result.user.id)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Sessione non valida") from exc
