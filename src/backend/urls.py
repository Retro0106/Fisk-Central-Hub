from django.urls import path

from .views import auth, marketplace, messaging, organizations, search, tutoring

urlpatterns = [
    # Auth and profile
    path("auth/csrf", auth.csrf),
    path("auth/session", auth.session),
    path("auth/register", auth.register),
    path("auth/verify-email", auth.verify_email),
    path("auth/resend-verification", auth.resend_verification),
    path("auth/login", auth.login_view),
    path("auth/logout", auth.logout_view),
    path("me", auth.me),
    # Marketplace
    path("categories", marketplace.categories),
    path("listings", marketplace.listings),
    path("listings/<int:listing_id>", marketplace.listing_detail),
    # Search
    path("search", search.semantic_search),
    # Messaging
    path("users", messaging.users),
    path("conversations", messaging.conversations),
    path("conversations/<int:conv_id>/messages", messaging.conversation_messages),
    # Tutoring
    path("courses", tutoring.courses),
    path("tutoring/profile", tutoring.my_tutor_profile),
    path("tutoring/tutors", tutoring.tutors),
    path("tutoring/requests", tutoring.help_requests),
    path("tutoring/requests/<int:request_id>", tutoring.help_request_detail),
    path("tutoring/requests/<int:request_id>/close", tutoring.close_help_request),
    path("tutoring/matches/<int:match_id>/<str:action>", tutoring.respond_to_match),
    path("tutoring/my-matches", tutoring.matches_for_me),
    # Organizations
    path("organizations", organizations.organizations),
    path("organizations/<slug:slug>", organizations.organization_detail),
    path("organizations/<slug:slug>/join", organizations.join_organization),
    path("organizations/<slug:slug>/leave", organizations.leave_organization),
    path("organizations/<slug:slug>/events", organizations.create_event),
    path("events", organizations.events),
    path("events/<int:event_id>", organizations.event_detail),
]
