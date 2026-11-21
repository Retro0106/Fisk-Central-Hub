from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import serializers
from ..models import Category, Listing


@api_view(["GET"])
def categories(request):
    return Response([{"id": c.id, "name": c.name} for c in Category.objects.all()])


def _apply_listing_fields(item, data):
    """Copy editable fields from request data onto a listing. Returns an error string or None."""
    if "title" in data:
        item.title = str(data["title"] or "").strip()[:120]
    if "description" in data:
        item.description = str(data["description"] or "").strip()
    if "price" in data:
        try:
            price = Decimal(str(data["price"]))
        except (InvalidOperation, ValueError):
            return "Price must be a number."
        if price < 0:
            return "Price can't be negative."
        item.price = price.quantize(Decimal("0.01"))
    if "color" in data:
        item.color = str(data["color"] or "").strip()[:30]
    if "condition" in data:
        if data["condition"] not in dict(Listing.CONDITIONS):
            return "Unknown condition."
        item.condition = data["condition"]
    if "image" in data:
        item.image = str(data["image"] or "").strip()
    if "category" in data:
        item.category = Category.objects.filter(name=data["category"]).first()
    if "is_sold" in data:
        item.is_sold = bool(data["is_sold"])
    if not item.title:
        return "Title is required."
    return None


@api_view(["GET", "POST"])
def listings(request):
    if request.method == "POST":
        item = Listing(user=request.user)
        error = _apply_listing_fields(item, request.data)
        if error:
            return Response({"error": error}, status=400)
        item.save()
        return Response(serializers.listing(item), status=201)

    qs = Listing.objects.select_related("user", "category")
    if request.query_params.get("mine") == "1":
        qs = qs.filter(user=request.user)
    else:
        qs = qs.filter(is_sold=False)
    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category__name=category)
    return Response([serializers.listing(item) for item in qs])


@api_view(["GET", "PATCH", "DELETE"])
def listing_detail(request, listing_id):
    item = get_object_or_404(Listing.objects.select_related("user", "category"), id=listing_id)
    if request.method == "GET":
        return Response(serializers.listing(item))

    if item.user_id != request.user.id:
        return Response({"error": "Only the seller can change this listing."}, status=403)
    if request.method == "DELETE":
        item.delete()
        return Response(status=204)

    error = _apply_listing_fields(item, request.data)
    if error:
        return Response({"error": error}, status=400)
    item.save()
    return Response(serializers.listing(item))
