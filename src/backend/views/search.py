import logging

from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import search, serializers
from ..models import Event, Listing, Organization, TutorProfile

logger = logging.getLogger(__name__)

LOADERS = {
    "listing": (Listing.objects.select_related("user", "category"), serializers.listing),
    "tutor": (TutorProfile.objects.select_related("user").prefetch_related("courses"), serializers.tutor),
    "organization": (Organization.objects.all(), serializers.organization),
    "event": (Event.objects.select_related("organization"), serializers.event),
}


def _results(type_name, query, k, min_score):
    ranked = search.search(type_name, query, k=k, min_score=min_score)
    queryset, serialize = LOADERS[type_name]
    objects = queryset.in_bulk([obj_id for obj_id, _ in ranked])
    out = []
    for obj_id, score in ranked:
        obj = objects.get(obj_id)
        if obj is None:
            continue
        data = serialize(obj)
        data["score"] = round(score, 4)
        out.append(data)
    return out


@api_view(["GET"])
def semantic_search(request):
    """
    GET /api/search?q=...&type=listing|tutor|organization|event|all&k=8&min_score=0.2
    Returns {"query": ..., "results": {type: [items with "score"]}}.
    """
    query = request.query_params.get("q", "").strip()
    requested = request.query_params.get("type", "all")
    types = search.TYPE_NAMES if requested == "all" else [requested]
    if any(t not in search.TYPE_NAMES for t in types):
        return Response({"error": f"type must be one of: all, {', '.join(search.TYPE_NAMES)}"}, status=400)

    try:
        k = max(1, min(int(request.query_params.get("k", 8)), 50))
        min_score = request.query_params.get("min_score")
        min_score = float(min_score) if min_score is not None else None
    except ValueError:
        return Response({"error": "k and min_score must be numbers."}, status=400)

    if not query:
        return Response({"query": query, "results": {t: [] for t in types}})

    try:
        results = {t: _results(t, query, k, min_score) for t in types}
    except Exception:
        logger.exception("Semantic search failed")
        return Response({"error": "Search is unavailable right now."}, status=503)
    return Response({"query": query, "results": results})
