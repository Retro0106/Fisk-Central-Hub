from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import serializers
from ..models import Account, Conversation, Message


def get_or_create_conversation_between(user_a, user_b):
    low, high = sorted([user_a.id, user_b.id])
    conversation, _ = Conversation.objects.get_or_create(user_one_id=low, user_two_id=high)
    return conversation


@api_view(["GET"])
def users(request):
    people = Account.objects.filter(email_verified=True).exclude(id=request.user.id).order_by("name")
    return Response([serializers.user_public(u) for u in people])


@api_view(["GET", "POST"])
def conversations(request):
    me = request.user
    if request.method == "POST":
        other = get_object_or_404(Account, id=request.data.get("other_user_id"))
        if other.id == me.id:
            return Response({"error": "You can't message yourself."}, status=400)
        conversation = get_or_create_conversation_between(me, other)
        return Response({"conversation_id": conversation.id, "other_user": serializers.user_public(other)})

    out = []
    qs = Conversation.objects.filter(Q(user_one=me) | Q(user_two=me)).select_related("user_one", "user_two")
    for conversation in qs:
        last = conversation.messages.order_by("-sent_at").first()
        out.append(
            {
                "id": conversation.id,
                "other_user": serializers.user_public(conversation.other_user(me)),
                "last_message": serializers.message(last) if last else None,
            }
        )
    out.sort(key=lambda c: c["last_message"]["sent_at"] if c["last_message"] else "", reverse=True)
    return Response(out)


@api_view(["GET", "POST"])
def conversation_messages(request, conv_id):
    conversation = get_object_or_404(Conversation, id=conv_id)
    if not conversation.includes(request.user):
        return Response({"error": "Not your conversation."}, status=403)

    if request.method == "POST":
        content = str(request.data.get("content") or "").strip()
        if not content:
            return Response({"error": "Message can't be empty."}, status=400)
        msg = Message.objects.create(conversation=conversation, sender=request.user, content=content[:1000])
        return Response(serializers.message(msg), status=201)

    return Response([serializers.message(m) for m in conversation.messages.all()])
