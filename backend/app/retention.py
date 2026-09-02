from datetime import datetime, timezone

from .photos import BUCKET


def cleanup_expired_candidates(database) -> int:
    expired = database.table("candidates").select("id").lt(
        "expires_at", datetime.now(timezone.utc).isoformat()
    ).execute().data or []
    if not expired:
        return 0
    paths = [f"{candidate['id']}.webp" for candidate in expired]
    try:
        database.storage.from_(BUCKET).remove(paths)
    except Exception:
        pass
    ids = [candidate["id"] for candidate in expired]
    database.table("candidates").delete().in_("id", ids).execute()
    return len(ids)
