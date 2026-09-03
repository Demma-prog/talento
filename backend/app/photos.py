from io import BytesIO
from zipfile import ZipFile

import fitz
from google import genai
from google.genai import types
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from .settings import settings


BUCKET = "candidate-photos"


class PortraitDetection(BaseModel):
    found: bool
    box_2d: list[int] = Field(description="[ymin, xmin, ymax, xmax], coordinates from 0 to 1000")
    confidence: float = Field(ge=0, le=1)


def _pdf_preview(data: bytes) -> Image.Image:
    document = fitz.open(stream=data, filetype="pdf")
    if not document.page_count:
        raise ValueError("PDF vuoto")
    pixmap = document[0].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    return Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")


def _docx_preview(data: bytes) -> Image.Image:
    images = []
    with ZipFile(BytesIO(data)) as archive:
        for name in archive.namelist():
            if not name.startswith("word/media/"):
                continue
            try:
                image = Image.open(BytesIO(archive.read(name))).convert("RGB")
                if image.width >= 100 and image.height >= 100:
                    images.append(image)
            except Exception:
                continue
    if not images:
        raise ValueError("Nessuna immagine utilizzabile")
    images = sorted(images, key=lambda image: image.width * image.height, reverse=True)[:8]
    cell, columns = 360, 3
    rows = (len(images) + columns - 1) // columns
    sheet = Image.new("RGB", (cell * columns, cell * rows), "white")
    for index, image in enumerate(images):
        thumb = ImageOps.contain(image, (cell - 20, cell - 20))
        x = index % columns * cell + (cell - thumb.width) // 2
        y = index // columns * cell + (cell - thumb.height) // 2
        sheet.paste(thumb, (x, y))
    return sheet


def _preview(data: bytes, filename: str) -> Image.Image:
    suffix = filename.lower().rsplit(".", 1)[-1]
    if suffix == "pdf":
        return _pdf_preview(data)
    if suffix == "docx":
        return _docx_preview(data)
    raise ValueError("Formato foto non supportato")


def _detect_portrait(image: Image.Image) -> PortraitDetection:
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=82, optimize=True)
    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[
            types.Part.from_bytes(data=buffer.getvalue(), mime_type="image/jpeg"),
            """Individua esclusivamente una chiara foto ritratto del candidato nel CV.
            Ignora loghi, icone, firme, documenti, persone nelle immagini decorative e
            fotografie di gruppo. Se non è chiaramente una foto profilo, found=false.
            Se presente, box_2d deve racchiudere la foto del volto e delle spalle, con
            coordinate [ymin,xmin,ymax,xmax] normalizzate 0-1000. Non dedurre né
            classificare sesso, età, etnia o altre caratteristiche della persona.""",
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PortraitDetection,
            temperature=0,
        ),
    )
    return response.parsed or PortraitDetection.model_validate_json(response.text)


def _crop(image: Image.Image, detection: PortraitDetection) -> bytes:
    if not detection.found or detection.confidence < 0.7 or len(detection.box_2d) != 4:
        raise ValueError("Ritratto non affidabile")
    ymin, xmin, ymax, xmax = [max(0, min(1000, value)) for value in detection.box_2d]
    if ymax <= ymin or xmax <= xmin:
        raise ValueError("Riquadro non valido")
    width, height = image.size
    box = (int(xmin / 1000 * width), int(ymin / 1000 * height), int(xmax / 1000 * width), int(ymax / 1000 * height))
    portrait = ImageOps.fit(image.crop(box), (256, 256), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    output = BytesIO()
    portrait.save(output, format="WEBP", quality=78, method=6)
    return output.getvalue()


def _portrait_file(image: Image.Image) -> bytes:
    portrait = ImageOps.fit(image.convert("RGB"), (256, 256), method=Image.Resampling.LANCZOS, centering=(0.5, 0.38))
    output = BytesIO()
    portrait.save(output, format="WEBP", quality=78, method=6)
    return output.getvalue()


def _embedded_portrait(data: bytes, filename: str) -> bytes:
    suffix = filename.lower().rsplit(".", 1)[-1]
    images: list[Image.Image] = []
    if suffix == "pdf":
        document = fitz.open(stream=data, filetype="pdf")
        if document.page_count:
            for item in document[0].get_images(full=True):
                try: images.append(Image.open(BytesIO(document.extract_image(item[0])["image"])).convert("RGB"))
                except Exception: continue
    elif suffix == "docx":
        with ZipFile(BytesIO(data)) as archive:
            for name in archive.namelist():
                if name.startswith("word/media/"):
                    try: images.append(Image.open(BytesIO(archive.read(name))).convert("RGB"))
                    except Exception: continue
    candidates = [image for image in images if image.width >= 120 and image.height >= 140 and 0.52 <= image.width / image.height <= 1.18]
    if not candidates:
        raise ValueError("Nessuna fotografia incorporata affidabile")
    return _portrait_file(max(candidates, key=lambda image: image.width * image.height))


def ensure_bucket(database):
    try:
        database.storage.create_bucket(BUCKET, options={"public": False, "file_size_limit": 524288})
    except Exception:
        pass


def extract_and_store_photo(database, candidate_id: str, data: bytes, filename: str) -> bool:
    if settings.ai_provider.lower() == "ollama":
        photo = _embedded_portrait(data, filename)
    else:
        image = _preview(data, filename)
        photo = _crop(image, _detect_portrait(image))
    ensure_bucket(database)
    path = f"{candidate_id}.webp"
    try:
        database.storage.from_(BUCKET).remove([path])
    except Exception:
        pass
    database.storage.from_(BUCKET).upload(path, photo, {"content-type": "image/webp", "upsert": "true"})
    return True


def extract_and_store_photo_from_cv_result(database, candidate_id: str, data: bytes, filename: str, extracted) -> bool:
    if settings.ai_provider.lower() == "ollama":
        photo = _embedded_portrait(data, filename)
        ensure_bucket(database)
        path = f"{candidate_id}.webp"
        try:
            database.storage.from_(BUCKET).remove([path])
        except Exception:
            pass
        database.storage.from_(BUCKET).upload(path, photo, {"content-type": "image/webp", "upsert": "true"})
        return True
    suffix = filename.lower().rsplit(".", 1)[-1]
    if suffix != "pdf":
        return extract_and_store_photo(database, candidate_id, data, filename)
    detection = PortraitDetection(
        found=extracted.portrait_found,
        box_2d=extracted.portrait_box_2d,
        confidence=extracted.portrait_confidence,
    )
    image = _pdf_preview(data)
    try:
        photo = _crop(image, detection)
    except ValueError:
        photo = _crop(image, _detect_portrait(image))
    ensure_bucket(database)
    path = f"{candidate_id}.webp"
    try:
        database.storage.from_(BUCKET).remove([path])
    except Exception:
        pass
    database.storage.from_(BUCKET).upload(path, photo, {"content-type": "image/webp", "upsert": "true"})
    return True
