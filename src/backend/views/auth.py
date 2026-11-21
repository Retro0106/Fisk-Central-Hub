import re

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .. import serializers
from ..models import Account, Course, is_fisk_email


def verification_url(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}/verify-email?uid={uid}&token={token}"


def send_verification_email(user):
    url = verification_url(user)
    send_mail(
        subject="Verify your Fisk Central Hub account",
        message=(
            f"Hi {user.name},\n\n"
            f"Confirm your Fisk email address to finish setting up your account:\n{url}\n\n"
            "If you didn't sign up, you can ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
    return url


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    """Sets the csrftoken cookie the frontend sends back on every write."""
    return Response({})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    email = (request.data.get("email") or "").strip().lower()
    username = (request.data.get("username") or "").strip()
    name = (request.data.get("name") or "").strip()
    password = request.data.get("password") or ""

    if not (email and username and name and password):
        return Response({"error": "Name, username, email, and password are all required."}, status=400)
    if not is_fisk_email(email):
        return domain_error()
    if Account.objects.filter(email=email).exists():
        return Response({"error": "An account with that email already exists."}, status=400)
    if Account.objects.filter(username__iexact=username).exists():
        return Response({"error": "That username is taken."}, status=400)

    candidate = Account(email=email, username=username, name=name)
    try:
        validate_password(password, user=candidate)
    except ValidationError as exc:
        return Response({"error": " ".join(exc.messages)}, status=400)

    user = Account.objects.create_user(email=email, username=username, name=name, password=password)
    url = send_verification_email(user)

    data = {"email": user.email, "message": "Check your Fisk email for a verification link."}
    if settings.DEBUG:
        data["dev_verification_url"] = url
    return Response(data, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_email(request):
    uid = request.data.get("uid") or ""
    token = request.data.get("token") or ""
    try:
        user = Account.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (Account.DoesNotExist, ValueError, TypeError, OverflowError):
        user = None

    if user is None or not default_token_generator.check_token(user, token):
        return Response({"error": "This verification link is invalid or has expired."}, status=400)

    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Response(serializers.user_private(user))


@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification(request):
    email = (request.data.get("email") or "").strip().lower()
    user = Account.objects.filter(email=email, email_verified=False).first()
    data = {"message": "If that account exists and isn't verified yet, a new link is on its way."}
    if user:
        url = send_verification_email(user)
        if settings.DEBUG:
            data["dev_verification_url"] = url
    return Response(data)


def domain_error():
    domains = " or ".join(f"@{d}" for d in settings.ALLOWED_EMAIL_DOMAINS)
    return Response({"error": f"Email must be a {domains} address."}, status=400)


def _demo_account(email, password):
    """Find or create a verified account for presentation-mode login."""
    user = Account.objects.filter(email=email).first()
    if user is None:
        local = email.split("@")[0]
        name = " ".join(part.capitalize() for part in re.split(r"[._\-+]+", local) if part) or "Fisk Student"
        base = re.sub(r"[^a-z0-9._]", "", local)[:24] or "student"
        username, n = base, 1
        while Account.objects.filter(username__iexact=username).exists():
            n += 1
            username = f"{base}{n}"
        user = Account.objects.create_user(
            email=email, username=username, name=name[:60], password=password, email_verified=True
        )
    elif not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])
    return user


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    if not is_fisk_email(email):
        return domain_error()

    if settings.DEMO_LOGIN:
        if not password:
            return Response({"error": "Enter a password."}, status=400)
        user = _demo_account(email, password)
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        return Response(serializers.user_private(user))

    user = authenticate(request, email=email, password=password)
    if user is None:
        return Response({"error": "Incorrect email or password."}, status=400)
    if not user.email_verified:
        return Response(
            {"error": "Verify your Fisk email before logging in.", "code": "unverified"}, status=403
        )
    login(request, user)
    return Response(serializers.user_private(user))


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response({})


@api_view(["GET", "PATCH"])
def me(request):
    user = request.user
    if request.method == "PATCH":
        for field in ("name", "major", "bio"):
            if field in request.data:
                setattr(user, field, str(request.data[field] or "").strip())
        if "class_year" in request.data:
            year = request.data["class_year"]
            try:
                user.class_year = int(year) if year not in (None, "") else None
            except (TypeError, ValueError):
                return Response({"error": "Class year must be a number."}, status=400)
        if not user.name:
            return Response({"error": "Name can't be empty."}, status=400)
        user.save()
        if "course_ids" in request.data:
            user.courses_taken.set(Course.objects.filter(id__in=request.data["course_ids"] or []))
    return Response(serializers.user_private(user))


@api_view(["GET"])
@permission_classes([AllowAny])
def session(request):
    """The signed-in user, or null. Lets the frontend restore a session on load."""
    user = serializers.user_private(request.user) if request.user.is_authenticated else None
    return Response({"user": user, "demo_login": settings.DEMO_LOGIN})
