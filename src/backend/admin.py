from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from backend.models import (
    Account,
    Category,
    Conversation,
    Course,
    Event,
    HelpRequest,
    Listing,
    Membership,
    Message,
    Organization,
    TutorMatch,
    TutorProfile,
)


class AccountAdmin(UserAdmin):
    list_display = ("email", "name", "major", "email_verified", "is_demo", "is_staff")
    list_filter = ("email_verified", "is_demo")
    search_fields = ("email", "username", "name")
    readonly_fields = ("date_joined", "last_login")
    ordering = ("email",)
    filter_horizontal = ("courses_taken",)
    fieldsets = (
        (None, {"fields": ("email", "username", "name", "password")}),
        ("Profile", {"fields": ("major", "class_year", "bio", "courses_taken")}),
        ("Status", {"fields": ("email_verified", "is_active", "is_demo", "is_staff", "is_admin", "is_superuser")}),
        ("Dates", {"fields": ("date_joined", "last_login")}),
    )
    add_fieldsets = ((None, {"fields": ("email", "username", "name", "password1", "password2")}),)


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0


class EventInline(admin.TabularInline):
    model = Event
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "is_demo")
    list_filter = ("category", "is_demo")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [MembershipInline, EventInline]


@admin.register(TutorProfile)
class TutorProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "is_active")
    filter_horizontal = ("courses",)


admin.site.register(Account, AccountAdmin)
for model in (Category, Course, Listing, HelpRequest, TutorMatch, Event, Conversation, Message):
    admin.site.register(model)
