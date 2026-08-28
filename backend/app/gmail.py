import base64, hashlib, hmac, json, time
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from supabase import create_client
from .auth import require_user
from .settings import settings

router = APIRouter(prefix="/gmail", tags=["gmail"])
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def configured():
    return all([settings.google_client_id, settings.google_client_secret, settings.google_redirect_uri,
                settings.gmail_token_encryption_key, settings.oauth_state_secret,
                settings.supabase_url, settings.supabase_service_role_key])

def flow(state=None):
    config = {"web": {"client_id": settings.google_client_id, "client_secret": settings.google_client_secret,
      "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token",
      "redirect_uris": [settings.google_redirect_uri]}}
    return Flow.from_client_config(config, scopes=SCOPES, state=state, redirect_uri=settings.google_redirect_uri)

def sign_state(user_id):
    payload = base64.urlsafe_b64encode(json.dumps({"sub": user_id, "exp": int(time.time()) + 600}).encode()).decode().rstrip("=")
    signature = hmac.new(settings.oauth_state_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{signature}"

def verify_state(value):
    try:
        payload, signature = value.rsplit(".", 1)
        expected = hmac.new(settings.oauth_state_secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected): raise ValueError()
        decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if decoded["exp"] < time.time(): raise ValueError()
        return str(decoded["sub"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Stato OAuth non valido") from exc

@router.get("/connect")
def connect(user_id: str = Depends(require_user)):
    if not configured(): raise HTTPException(status_code=503, detail="Collegamento Gmail non configurato")
    state = sign_state(user_id)
    url, _ = flow(state).authorization_url(access_type="offline", include_granted_scopes="true", prompt="consent")
    return {"authorization_url": url}

@router.get("/callback")
def callback(code: str = Query(...), state: str = Query(...)):
    if not configured(): raise HTTPException(status_code=503, detail="Collegamento Gmail non configurato")
    user_id = verify_state(state)
    oauth = flow(state); oauth.fetch_token(code=code)
    credentials = oauth.credentials
    if not credentials.refresh_token: raise HTTPException(status_code=400, detail="Refresh token assente")
    profile = build("gmail", "v1", credentials=credentials, cache_discovery=False).users().getProfile(userId="me").execute()
    encrypted = Fernet(settings.gmail_token_encryption_key.encode()).encrypt(credentials.refresh_token.encode()).decode()
    create_client(settings.supabase_url, settings.supabase_service_role_key).table("gmail_connections").upsert({
      "user_id": user_id, "email_address": profile["emailAddress"], "encrypted_refresh_token": encrypted, "scopes": SCOPES
    }).execute()
    return RedirectResponse(f"{settings.frontend_url}/impostazioni?gmail=connected", status_code=302)

@router.get("/status")
def status(user_id: str = Depends(require_user)):
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return {"configured": False, "connected": False}
    result = create_client(settings.supabase_url, settings.supabase_service_role_key).table("gmail_connections").select("email_address,connected_at").eq("user_id", user_id).limit(1).execute()
    connection = result.data[0] if result and result.data else None
    return {"configured": configured(), "connected": connection is not None, "connection": connection}
