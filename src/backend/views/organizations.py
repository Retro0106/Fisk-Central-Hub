from django.db.models import Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import serializers
from ..models import Event, Membership, Organization


def _can_manage(user, org):
    return Membership.objects.filter(user=user, organization=org, role__in=["officer", "admin"]).exists()


@api_view(["GET"])
def organizations(request):
    qs = Organization.objects.annotate(member_total=Count("memberships"))
    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category=category)
    mine = set(Membership.objects.filter(user=request.user).values_list("organization_id", flat=True))
    out = []
    for org in qs:
        data = serializers.organization(org, member_count=org.member_total)
        data["is_member"] = org.id in mine
        out.append(data)
    return Response(
        {"categories": [{"value": v, "label": label} for v, label in Organization.CATEGORIES], "organizations": out}
    )


@api_view(["GET"])
def organization_detail(request, slug):
    org = get_object_or_404(Organization, slug=slug)
    memberships = org.memberships.select_related("user").order_by("role", "user__name")
    mine = next((m for m in memberships if m.user_id == request.user.id), None)
    now = timezone.now()
    events = org.events.select_related("organization")
    data = serializers.organization(org, member_count=len(memberships))
    data.update(
        {
            "members": [{"user": serializers.user_public(m.user), "role": m.role} for m in memberships],
            "my_role": mine.role if mine else None,
            "can_manage": bool(mine and mine.role in ("officer", "admin")),
            "upcoming_events": [serializers.event(e) for e in events.filter(start_time__gte=now)],
            "past_events": [serializers.event(e) for e in events.filter(start_time__lt=now).order_by("-start_time")[:5]],
        }
    )
    return Response(data)


@api_view(["POST"])
def join_organization(request, slug):
    org = get_object_or_404(Organization, slug=slug)
    Membership.objects.get_or_create(user=request.user, organization=org)
    return Response({"my_role": Membership.objects.get(user=request.user, organization=org).role})


@api_view(["POST"])
def leave_organization(request, slug):
    org = get_object_or_404(Organization, slug=slug)
    membership = Membership.objects.filter(user=request.user, organization=org).first()
    if membership and membership.role == "admin" and not org.memberships.filter(role="admin").exclude(id=membership.id).exists():
        return Response({"error": "Make someone else an admin before leaving."}, status=400)
    if membership:
        membership.delete()
    return Response({"my_role": None})


def _apply_event_fields(event, data):
    if "title" in data:
        event.title = str(data["title"] or "").strip()[:120]
    for field in ("description", "location"):
        if field in data:
            setattr(event, field, str(data[field] or "").strip())
    for field in ("start_time", "end_time"):
        if field in data:
            value = parse_datetime(data[field]) if data[field] else None
            if value is not None and timezone.is_naive(value):
                value = timezone.make_aware(value)
            setattr(event, field, value)
    if not event.title or not event.start_time:
        return "Title and start time are required."
    if event.end_time and event.end_time < event.start_time:
        return "The event can't end before it starts."
    return None


@api_view(["POST"])
def create_event(request, slug):
    org = get_object_or_404(Organization, slug=slug)
    if not _can_manage(request.user, org):
        return Response({"error": "Only officers can post events."}, status=403)
    event = Event(organization=org)
    error = _apply_event_fields(event, request.data)
    if error:
        return Response({"error": error}, status=400)
    event.save()
    return Response(serializers.event(event), status=201)


@api_view(["PATCH", "DELETE"])
def event_detail(request, event_id):
    event = get_object_or_404(Event.objects.select_related("organization"), id=event_id)
    if not _can_manage(request.user, event.organization):
        return Response({"error": "Only officers can change events."}, status=403)
    if request.method == "DELETE":
        event.delete()
        return Response(status=204)
    error = _apply_event_fields(event, request.data)
    if error:
        return Response({"error": error}, status=400)
    event.save()
    return Response(serializers.event(event))


@api_view(["GET"])
def events(request):
    qs = Event.objects.filter(start_time__gte=timezone.now()).select_related("organization")
    org_slug = request.query_params.get("org")
    if org_slug:
        qs = qs.filter(organization__slug=org_slug)
    if request.query_params.get("mine") == "1":
        qs = qs.filter(organization__memberships__user=request.user)
    return Response([serializers.event(e) for e in qs[:100]])
