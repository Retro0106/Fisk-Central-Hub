from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils.text import slugify


DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
PERIODS = ["morning", "afternoon", "evening"]
AVAILABILITY_SLOTS = [f"{day}:{period}" for day in DAYS for period in PERIODS]


def clean_availability(slots):
    """Keep only valid "day:period" slots, deduplicated, in calendar order."""
    if not isinstance(slots, (list, tuple)):
        return []
    wanted = {str(s).lower() for s in slots}
    return [slot for slot in AVAILABILITY_SLOTS if slot in wanted]


def is_fisk_email(email):
    domain = (email or "").rsplit("@", 1)[-1].lower()
    return "@" in (email or "") and domain in settings.ALLOWED_EMAIL_DOMAINS


class MyAccountManager(BaseUserManager):
    def create_user(self, email, username, name, password=None, **extra):
        if not email:
            raise ValueError("Users must have an email address")
        if not username:
            raise ValueError("Users must have a username")

        user = self.model(
            email=self.normalize_email(email).lower(),
            username=username,
            name=name,
            **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, name, password):
        user = self.create_user(
            email=email,
            password=password,
            username=username,
            name=name,
            email_verified=True,
        )
        user.is_admin = True
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=120)

    class Meta:
        db_table = "courses"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} {self.title}"


class Account(AbstractBaseUser):
    email = models.EmailField(verbose_name="email", max_length=120, unique=True)
    username = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=60, default="User")
    date_joined = models.DateTimeField(verbose_name="date joined", auto_now_add=True)
    last_login = models.DateTimeField(verbose_name="last login", auto_now=True)

    email_verified = models.BooleanField(default=False)
    major = models.CharField(max_length=80, blank=True)
    class_year = models.PositiveSmallIntegerField(null=True, blank=True)
    bio = models.TextField(max_length=500, blank=True)
    courses_taken = models.ManyToManyField(Course, blank=True, related_name="students")
    is_demo = models.BooleanField(default=False)

    is_admin = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "name"]

    objects = MyAccountManager()

    def __str__(self):
        return self.email

    # All admins have all permissions.
    def has_perm(self, perm, obj=None):
        return self.is_admin

    def has_module_perms(self, app_label):
        return True


class Category(models.Model):
    name = models.CharField(max_length=30, unique=True)
    description = models.TextField(max_length=200, blank=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = "categories"
        verbose_name = "Category"
        verbose_name_plural = "Categories"
        ordering = ["name"]


class Listing(models.Model):
    CONDITIONS = [
        ("new", "Brand new"),
        ("like-new", "Like new"),
        ("good", "Good"),
        ("fair", "Fair"),
    ]

    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    color = models.CharField(max_length=30, blank=True)
    condition = models.CharField(max_length=10, choices=CONDITIONS, default="good")
    image = models.CharField(max_length=500, blank=True, help_text="Image URL or a path like /listings/photo.jpg")
    is_sold = models.BooleanField(default=False)

    user = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="listings")
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="listings"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        db_table = "listings"
        ordering = ["-created_at"]


class TutorProfile(models.Model):
    user = models.OneToOneField(Account, on_delete=models.CASCADE, related_name="tutor_profile")
    courses = models.ManyToManyField(Course, blank=True, related_name="tutors")
    subjects = models.TextField(
        max_length=500, blank=True, help_text="Free text, e.g. 'derivatives, limits, exam prep'"
    )
    availability = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tutor_profiles"

    def __str__(self):
        return f"Tutor: {self.user.name}"


class HelpRequest(models.Model):
    STATUSES = [("open", "Open"), ("matched", "Matched"), ("closed", "Closed")]

    title = models.CharField(max_length=120)
    description = models.TextField(max_length=1000)
    course = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="help_requests"
    )
    subject_area = models.CharField(max_length=60, blank=True)
    preferred_availability = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="open")
    user = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="help_requests")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    class Meta:
        db_table = "help_requests"
        ordering = ["-created_at"]


class TutorMatch(models.Model):
    STATUSES = [("proposed", "Proposed"), ("accepted", "Accepted"), ("declined", "Declined")]

    request = models.ForeignKey(HelpRequest, on_delete=models.CASCADE, related_name="matches")
    tutor = models.ForeignKey(TutorProfile, on_delete=models.CASCADE, related_name="matches")
    score = models.FloatField()
    reasons = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=10, choices=STATUSES, default="proposed")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tutor_matches"
        ordering = ["-score"]
        constraints = [
            models.UniqueConstraint(fields=["request", "tutor"], name="unique_request_tutor")
        ]


class Organization(models.Model):
    CATEGORIES = [
        ("academic", "Academic"),
        ("greek", "Greek life"),
        ("cultural", "Cultural"),
        ("service", "Service"),
        ("arts", "Arts & performance"),
        ("professional", "Professional"),
        ("sports", "Sports & recreation"),
        ("other", "Other"),
    ]

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=CATEGORIES, default="other")
    contact_email = models.EmailField(blank=True)
    image = models.CharField(max_length=500, blank=True, help_text="Image URL or a path like /organizations/photo.jpg")
    is_demo = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "organizations"
        ordering = ["name"]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:140]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Membership(models.Model):
    ROLES = [("member", "Member"), ("officer", "Officer"), ("admin", "Admin")]

    user = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=10, choices=ROLES, default="member")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "memberships"
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="unique_membership")
        ]

    def __str__(self):
        return f"{self.user} in {self.organization} ({self.role})"


class Event(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "events"
        ordering = ["start_time"]

    def __str__(self):
        return self.title


class Conversation(models.Model):
    user_one = models.ForeignKey(
        Account, related_name="conversation_user_one", on_delete=models.CASCADE
    )
    user_two = models.ForeignKey(
        Account, related_name="conversation_user_two", on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "conversations"
        verbose_name = "Conversation"
        verbose_name_plural = "Conversations"
        constraints = [
            models.UniqueConstraint(fields=["user_one", "user_two"], name="unique_user_pair")
        ]

    def save(self, *args, **kwargs):
        # Store each pair once: (8, 3) becomes (3, 8).
        if self.user_one_id > self.user_two_id:
            self.user_one, self.user_two = self.user_two, self.user_one
        super().save(*args, **kwargs)

    def includes(self, user):
        return user.id in (self.user_one_id, self.user_two_id)

    def other_user(self, user):
        return self.user_two if user.id == self.user_one_id else self.user_one

    def __str__(self):
        return f"{self.user_one} <-> {self.user_two}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, related_name="messages", on_delete=models.CASCADE)
    sender = models.ForeignKey(Account, related_name="sent_messages", on_delete=models.CASCADE)
    content = models.TextField(max_length=1000)
    sent_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message from {self.sender} at {self.sent_at}"

    class Meta:
        db_table = "messages"
        verbose_name = "Message"
        verbose_name_plural = "Messages"
        ordering = ["sent_at"]
