import re
from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from .settings import settings


class ExperienceExtraction(BaseModel):
    company: str | None
    role: str
    location: str | None
    start_date: str | None
    end_date: str | None
    is_current: bool
    description: str | None


class EducationExtraction(BaseModel):
    institution: str | None
    qualification: str
    field_of_study: str | None
    start_year: int | None
    end_year: int | None


class SkillExtraction(BaseModel):
    name: str
    category: str | None
    level: str | None


class CandidateExtraction(BaseModel):
    first_name: str
    last_name: str
    birth_year: int | None
    birth_place: str | None
    declared_gender: Literal["female", "male", "other"] | None
    email: str | None
    phone: str | None
    city: str | None
    bio: str | None
    experiences: list[ExperienceExtraction]
    education: list[EducationExtraction]
    skills: list[SkillExtraction]
    confidence: float = Field(ge=0, le=1)


PROMPT = """Estrai dal curriculum i dati del candidato in modo fedele.
Non inventare informazioni mancanti. Non dedurre il sesso dal nome, dalla foto,
dalla nazionalità o da altri indizi: declared_gender va compilato solo se il CV
lo dichiara esplicitamente. Per le date usa YYYY-MM-DD quando il giorno è noto,
YYYY-MM-01 quando sono noti solo anno e mese, e YYYY-01-01 quando è noto solo
l'anno. La bio deve essere una sintesi professionale neutra di massimo 500
caratteri. Inserisci soltanto esperienze, istruzione e competenze presenti nel CV.
"""


def extract_candidate(data: bytes, filename: str) -> CandidateExtraction:
    client = genai.Client(api_key=settings.gemini_api_key)
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf":
        content = [types.Part.from_bytes(data=data, mime_type="application/pdf"), PROMPT]
    elif suffix == "docx":
        from io import BytesIO
        from docx import Document
        document = Document(BytesIO(data))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        content = [PROMPT, text]
    else:
        raise ValueError("I file DOC meno recenti non sono ancora supportati")

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=content,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=CandidateExtraction,
            temperature=0.1,
        ),
    )
    if response.parsed:
        return response.parsed
    return CandidateExtraction.model_validate_json(response.text)


def normalize_email(value: str | None) -> str | None:
    return value.strip().lower() if value and "@" in value else None


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits[-10:] if len(digits) >= 7 else None
