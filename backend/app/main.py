from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .settings import settings
from .gmail import router as gmail_router
from .imports import router as imports_router
from .candidates import router as candidates_router

app = FastAPI(title="Talento Import API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(gmail_router)
app.include_router(imports_router)
app.include_router(candidates_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "talento-import"}
