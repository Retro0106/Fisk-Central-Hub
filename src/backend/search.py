"""
Semantic search across listings, tutors, organizations, and events.

Each content type has its own in-memory FAISS index of normalized
embeddings, so inner product equals cosine similarity. Indexes are built
on first use and rebuilt lazily after a save or delete marks them dirty
(see signals.py), which means new content is searchable without a restart.
"""

import logging
import threading
from dataclasses import dataclass
from typing import Callable

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


@dataclass
class SearchType:
    name: str
    queryset: Callable
    to_text: Callable


def _listing_text(listing):
    parts = [
        listing.title,
        listing.description,
        listing.category.name if listing.category_id else "",
        f"Condition: {listing.get_condition_display()}",
        f"Color: {listing.color}" if listing.color else "",
    ]
    return ". ".join(p for p in parts if p)


def _tutor_text(tutor):
    courses = ", ".join(f"{c.code} {c.title}" for c in tutor.courses.all())
    parts = [
        f"Tutor for {courses}" if courses else "",
        tutor.subjects,
        f"Major: {tutor.user.major}" if tutor.user.major else "",
        tutor.user.bio,
    ]
    return ". ".join(p for p in parts if p) or tutor.user.name


def _organization_text(org):
    return ". ".join(p for p in [org.name, org.get_category_display(), org.description] if p)


def _event_text(event):
    parts = [event.title, event.description, f"Hosted by {event.organization.name}", event.location]
    return ". ".join(p for p in parts if p)


def _types():
    from .models import Event, Listing, Organization, TutorProfile

    return {
        "listing": SearchType(
            "listing",
            lambda: Listing.objects.filter(is_sold=False).select_related("category"),
            _listing_text,
        ),
        "tutor": SearchType(
            "tutor",
            lambda: TutorProfile.objects.filter(is_active=True)
            .select_related("user")
            .prefetch_related("courses"),
            _tutor_text,
        ),
        "organization": SearchType("organization", lambda: Organization.objects.all(), _organization_text),
        "event": SearchType(
            "event",
            lambda: Event.objects.filter(start_time__gte=timezone.now()).select_related("organization"),
            _event_text,
        ),
    }


TYPE_NAMES = ["listing", "tutor", "organization", "event"]


class _SentenceTransformerEncoder:
    def __init__(self, model_name):
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model %s", model_name)
        self.model = SentenceTransformer(model_name)

    def encode(self, texts):
        return self.model.encode(
            list(texts), batch_size=32, convert_to_numpy=True, normalize_embeddings=True
        ).astype("float32")


_lock = threading.RLock()
_encoder = None
_indexes = {}  # type name -> (faiss index, list of object ids, embeddings)
_dirty = set(TYPE_NAMES)


def set_encoder(encoder):
    """Swap the embedding model (tests use a small fake one)."""
    global _encoder
    with _lock:
        _encoder = encoder
        _dirty.update(TYPE_NAMES)


def get_encoder():
    global _encoder
    with _lock:
        if _encoder is None:
            _encoder = _SentenceTransformerEncoder(settings.SEARCH_MODEL_NAME)
        return _encoder


def mark_dirty(type_name):
    with _lock:
        _dirty.add(type_name)


def embed(texts):
    return get_encoder().encode(texts)


def _build(type_name):
    import faiss

    spec = _types()[type_name]
    objects = list(spec.queryset())
    ids = [obj.id for obj in objects]
    if objects:
        vectors = embed([spec.to_text(obj) for obj in objects])
        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(vectors)
    else:
        vectors, index = None, None
    _indexes[type_name] = (index, ids, vectors)
    _dirty.discard(type_name)
    logger.info("Built %s search index with %d items", type_name, len(ids))


def ensure_built(type_name):
    with _lock:
        if type_name in _dirty or type_name not in _indexes:
            _build(type_name)
        return _indexes[type_name]


def search(type_name, query, k=8, min_score=None):
    """Return [(object_id, score)] best first."""
    if min_score is None:
        min_score = settings.SEARCH_MIN_SCORE
    index, ids, _ = ensure_built(type_name)
    if index is None or not query.strip():
        return []
    query_vec = embed([query])
    scores, positions = index.search(query_vec, max(1, min(k, len(ids))))
    return [
        (ids[pos], float(score))
        for score, pos in zip(scores[0], positions[0])
        if pos != -1 and score >= min_score
    ]


def similarity_to(type_name, query):
    """Cosine similarity between the query and every indexed object: {id: score}."""
    _, ids, vectors = ensure_built(type_name)
    if vectors is None:
        return {}
    query_vec = embed([query])[0]
    return dict(zip(ids, (vectors @ query_vec).tolist()))


def status():
    with _lock:
        return {
            name: {"built": name in _indexes, "dirty": name in _dirty, "count": len(_indexes.get(name, (None, []))[1])}
            for name in TYPE_NAMES
        }
