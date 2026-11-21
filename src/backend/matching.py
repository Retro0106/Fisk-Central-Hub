"""
Rank tutors for a help request.

score = 0.6 * semantic similarity (request text vs tutor profile text)
      + 0.25 * course match (tutor lists the requested course)
      + 0.15 * availability overlap (share of the student's preferred slots the tutor covers)
"""

from . import search
from .models import AVAILABILITY_SLOTS, TutorMatch, TutorProfile

SEMANTIC_WEIGHT = 0.6
COURSE_WEIGHT = 0.25
AVAILABILITY_WEIGHT = 0.15
MAX_MATCHES = 5
MIN_SCORE = 0.25


def request_text(help_request):
    parts = [help_request.title, help_request.description, help_request.subject_area]
    if help_request.course_id:
        parts.insert(0, f"{help_request.course.code} {help_request.course.title}")
    return ". ".join(p for p in parts if p)


def _format_slot(slot):
    day, period = slot.split(":")
    return f"{day.capitalize()} {period}"


def rank_tutors(help_request, limit=MAX_MATCHES):
    """Return [(tutor, score, reasons)] best first, without saving anything."""
    tutors = (
        TutorProfile.objects.filter(is_active=True)
        .exclude(user_id=help_request.user_id)
        .select_related("user")
        .prefetch_related("courses")
    )
    similarities = search.similarity_to("tutor", request_text(help_request))
    wanted_slots = set(help_request.preferred_availability or [])

    ranked = []
    for tutor in tutors:
        semantic = max(0.0, similarities.get(tutor.id, 0.0))
        course_ids = {c.id for c in tutor.courses.all()}
        course_match = 1.0 if help_request.course_id and help_request.course_id in course_ids else 0.0

        shared_slots = wanted_slots & set(tutor.availability or [])
        if wanted_slots:
            availability = len(shared_slots) / len(wanted_slots)
        else:
            availability = 1.0 if tutor.availability else 0.5

        score = (
            SEMANTIC_WEIGHT * semantic
            + COURSE_WEIGHT * course_match
            + AVAILABILITY_WEIGHT * availability
        )
        if score < MIN_SCORE:
            continue

        reasons = []
        if course_match:
            reasons.append(f"Tutors {help_request.course.code}")
        if semantic >= 0.5:
            reasons.append("Profile closely matches what you described")
        elif semantic >= 0.3:
            reasons.append("Profile is related to what you described")
        if shared_slots:
            slots = sorted(shared_slots, key=AVAILABILITY_SLOTS.index)
            reasons.append("Available " + ", ".join(_format_slot(s) for s in slots[:3]))
        if tutor.user.major:
            reasons.append(f"{tutor.user.major} major")
        ranked.append((tutor, round(score, 4), reasons))

    ranked.sort(key=lambda item: item[1], reverse=True)
    return ranked[:limit]


def refresh_matches(help_request):
    """Recompute proposed matches. Accepted or declined matches are left alone."""
    ranked = rank_tutors(help_request)
    help_request.matches.filter(status="proposed").exclude(
        tutor_id__in=[tutor.id for tutor, _, _ in ranked]
    ).delete()
    for tutor, score, reasons in ranked:
        match, created = TutorMatch.objects.get_or_create(
            request=help_request, tutor=tutor, defaults={"score": score, "reasons": reasons}
        )
        if not created and match.status == "proposed":
            match.score, match.reasons = score, reasons
            match.save(update_fields=["score", "reasons"])
    return help_request.matches.select_related("tutor__user").prefetch_related("tutor__courses")
