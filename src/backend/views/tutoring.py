from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import matching, serializers
from ..models import Course, HelpRequest, TutorMatch, TutorProfile, clean_availability
from .messaging import get_or_create_conversation_between


@api_view(["GET"])
def courses(request):
    return Response([serializers.course(c) for c in Course.objects.all()])


@api_view(["GET", "PUT"])
def my_tutor_profile(request):
    profile = TutorProfile.objects.filter(user=request.user).prefetch_related("courses").first()
    if request.method == "GET":
        return Response({"profile": serializers.tutor(profile) if profile else None})

    data = request.data
    course_ids = data.get("course_ids") or []
    subjects = str(data.get("subjects") or "").strip()
    if not course_ids and not subjects:
        return Response({"error": "Pick at least one course or describe the subjects you tutor."}, status=400)

    if profile is None:
        profile = TutorProfile(user=request.user)
    profile.subjects = subjects[:500]
    profile.availability = clean_availability(data.get("availability"))
    profile.is_active = bool(data.get("is_active", True))
    profile.save()
    profile.courses.set(Course.objects.filter(id__in=course_ids))
    return Response({"profile": serializers.tutor(profile)})


@api_view(["GET"])
def tutors(request):
    qs = TutorProfile.objects.filter(is_active=True).select_related("user").prefetch_related("courses")
    course_id = request.query_params.get("course")
    if course_id:
        qs = qs.filter(courses__id=course_id)
    return Response([serializers.tutor(t) for t in qs])


@api_view(["GET", "POST"])
def help_requests(request):
    if request.method == "POST":
        data = request.data
        title = str(data.get("title") or "").strip()
        description = str(data.get("description") or "").strip()
        if not title or not description:
            return Response({"error": "A title and a description are required."}, status=400)
        course = Course.objects.filter(id=data.get("course_id")).first() if data.get("course_id") else None
        help_request = HelpRequest.objects.create(
            user=request.user,
            title=title[:120],
            description=description[:1000],
            course=course,
            subject_area=str(data.get("subject_area") or "").strip()[:60],
            preferred_availability=clean_availability(data.get("preferred_availability")),
        )
        matches = matching.refresh_matches(help_request)
        return Response(
            {
                "request": serializers.help_request(help_request),
                "matches": [serializers.match(m) for m in matches],
            },
            status=201,
        )

    qs = HelpRequest.objects.filter(user=request.user).select_related("course", "user")
    return Response([serializers.help_request(r) for r in qs])


def _own_request(request, request_id):
    return get_object_or_404(HelpRequest.objects.select_related("course", "user"), id=request_id, user=request.user)


@api_view(["GET"])
def help_request_detail(request, request_id):
    help_request = _own_request(request, request_id)
    matches = help_request.matches.select_related("tutor__user").prefetch_related("tutor__courses")
    if help_request.status == "open" and request.query_params.get("refresh") == "1":
        matches = matching.refresh_matches(help_request)
    return Response(
        {"request": serializers.help_request(help_request), "matches": [serializers.match(m) for m in matches]}
    )


@api_view(["POST"])
def close_help_request(request, request_id):
    help_request = _own_request(request, request_id)
    help_request.status = "closed"
    help_request.save(update_fields=["status"])
    return Response(serializers.help_request(help_request))


@api_view(["POST"])
def respond_to_match(request, match_id, action):
    if action not in ("accept", "decline"):
        return Response({"error": "Action must be accept or decline."}, status=404)
    match = get_object_or_404(
        TutorMatch.objects.select_related("request", "tutor__user"), id=match_id, request__user=request.user
    )
    if action == "accept":
        match.status = "accepted"
        match.save(update_fields=["status"])
        match.request.status = "matched"
        match.request.save(update_fields=["status"])
        conversation = get_or_create_conversation_between(request.user, match.tutor.user)
        return Response({"match": serializers.match(match), "conversation_id": conversation.id})

    match.status = "declined"
    match.save(update_fields=["status"])
    return Response({"match": serializers.match(match)})


@api_view(["GET"])
def matches_for_me(request):
    """Requests where the signed-in user was proposed or accepted as the tutor."""
    qs = (
        TutorMatch.objects.filter(tutor__user=request.user)
        .exclude(status="declined")
        .select_related("request__user", "request__course", "tutor__user")
        .prefetch_related("tutor__courses")
        .order_by("-created_at")
    )
    return Response([serializers.match(m, include_request=True) for m in qs])
