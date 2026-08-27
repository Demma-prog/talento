from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .settings import settings
from .gmail import router as gmail_router

app = FastAPI(title="Talento Import API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(gmail_router)

class ImportRequest(BaseModel):
    max_messages: int = 10
    after: str | None = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "talento-import"}

@app.post("/imports")
def start_import(payload: ImportRequest, authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Autenticazione richiesta")
    # Il flusso Gmail/Gemini viene collegato dopo la configurazione delle credenziali.
    # La risposta a blocchi evita timeout sulle istanze gratuite di Render.
    return {
        "status": "ready",
        "batch_size": min(max(payload.max_messages, 1), 20),
        "message": "Backend configurato; collegare Gmail, Gemini e Supabase tramite variabili d'ambiente.",
    }
