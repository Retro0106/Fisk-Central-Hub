import hashlib
import re
from io import StringIO
from urllib.parse import parse_qs, urlparse

import numpy as np
from django.core import mail
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import search
from .models import Account, Conversation, Course, HelpRequest, Listing, Organization, TutorProfile

PASSWORD = "a-Strong-passw0rd"


class BagOfWordsEncoder:
    """Deterministic stand-in for the sentence-transformer: hashed word counts."""

    dim = 256

    def encode(self, texts):
        out = np.zeros((len(texts), self.dim), dtype="float32")
        for row, text in enumerate(texts):
            for word in re.findall(r"[a-z0-9]+", text.lower()):
                out[row, int(hashlib.md5(word.encode()).hexdigest(), 16) % self.dim] += 1
        norms = np.linalg.norm(out, axis=1, keepdims=True)
        return out / np.where(norms == 0, 1, norms)


def make_user(email="student@my.fisk.edu", username=None, verified=True, **extra):
    user = Account.objects.create_user(
        email=email, username=username or email.split("@")[0], name="Test Student", password=PASSWORD, **extra
    )
    user.email_verified = verified
    user.save()
    return user


class ApiTestCase(TestCase):
    def setUp(self):
        search.set_encoder(BagOfWordsEncoder())
        self.client = APIClient()

    def login(self, user):
        self.client.force_authenticate(user)


@override_settings(DEMO_LOGIN=True)
class DemoLoginTests(ApiTestCase):
    def login_as(self, email, password="anything"):
        return self.client.post("/api/auth/login", {"email": email, "password": password}, format="json")

    def test_new_fisk_email_logs_in_without_signing_up(self):
        response = self.login_as("Jane.Doe@my.fisk.edu")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Jane Doe")
        self.assertTrue(Account.objects.get(email="jane.doe@my.fisk.edu").email_verified)
        self.assertEqual(self.client.get("/api/me").status_code, 200)

    def test_existing_account_logs_in_and_is_reused(self):
        make_user(verified=False)
        self.assertEqual(self.login_as("student@my.fisk.edu", "wrong").status_code, 200)
        self.assertEqual(Account.objects.count(), 1)

    def test_non_fisk_email_is_still_rejected(self):
        for email in ["someone@gmail.com", "someone@fisk.edu", "someone@my.fisk.edu.evil.com"]:
            response = self.login_as(email)
            self.assertEqual(response.status_code, 400, email)
            self.assertIn("my.fisk.edu", response.data["error"])
        self.assertFalse(Account.objects.exists())


@override_settings(DEBUG=True, DEMO_LOGIN=False)
class RegistrationTests(ApiTestCase):
    def register(self, email):
        return self.client.post(
            "/api/auth/register",
            {"email": email, "username": "newstudent", "name": "New Student", "password": PASSWORD},
            format="json",
        )

    def test_rejects_non_fisk_email(self):
        response = self.register("someone@gmail.com")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Account.objects.exists())

    def test_rejects_lookalike_domain(self):
        self.assertEqual(self.register("someone@fisk.edu.evil.com").status_code, 400)

    def test_fisk_email_registers_unverified_and_sends_link(self):
        response = self.register("New.Student@my.fisk.edu")
        self.assertEqual(response.status_code, 201)
        user = Account.objects.get()
        self.assertEqual(user.email, "new.student@my.fisk.edu")
        self.assertFalse(user.email_verified)
        self.assertTrue(user.check_password(PASSWORD))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/verify-email?uid=", mail.outbox[0].body)

    def test_unverified_user_cannot_log_in(self):
        make_user(verified=False)
        response = self.client.post(
            "/api/auth/login", {"email": "student@my.fisk.edu", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data["code"], "unverified")

    def test_verification_link_activates_and_logs_in(self):
        self.register("new.student@my.fisk.edu")
        link = urlparse(re.search(r"https?://\S+", mail.outbox[0].body).group(0))
        params = {k: v[0] for k, v in parse_qs(link.query).items()}

        response = self.client.post("/api/auth/verify-email", params, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Account.objects.get().email_verified)
        self.assertEqual(self.client.get("/api/me").status_code, 200)

    def test_bad_token_is_rejected(self):
        self.register("new.student@my.fisk.edu")
        response = self.client.post("/api/auth/verify-email", {"uid": "MQ", "token": "nope"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_verified_user_logs_in_with_session(self):
        make_user()
        response = self.client.post(
            "/api/auth/login", {"email": "STUDENT@my.fisk.edu", "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/session").data["user"]["email"], "student@my.fisk.edu")


class AccessControlTests(ApiTestCase):
    def test_api_requires_login(self):
        for url in ["/api/listings", "/api/me", "/api/conversations", "/api/organizations", "/api/search?q=x"]:
            self.assertEqual(self.client.get(url).status_code, 403, url)

    def test_listing_is_owned_by_session_user_not_request_body(self):
        me, other = make_user(), make_user("other@my.fisk.edu")
        self.login(me)
        response = self.client.post(
            "/api/listings", {"title": "Desk lamp", "price": "12.50", "user": other.id}, format="json"
        )
        self.assertEqual(response.status_code, 201)
        listing = Listing.objects.get()
        self.assertEqual(listing.user, me)
        self.assertEqual(str(listing.price), "12.50")

    def test_only_seller_can_edit_listing(self):
        seller, buyer = make_user(), make_user("buyer@my.fisk.edu")
        listing = Listing.objects.create(user=seller, title="Mini fridge", price=50)
        self.login(buyer)
        response = self.client.patch(f"/api/listings/{listing.id}", {"is_sold": True}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_cannot_read_or_post_in_someone_elses_conversation(self):
        a, b, outsider = make_user("a@my.fisk.edu"), make_user("b@my.fisk.edu"), make_user("c@my.fisk.edu")
        conversation = Conversation.objects.create(user_one=a, user_two=b)
        self.login(outsider)
        url = f"/api/conversations/{conversation.id}/messages"
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(self.client.post(url, {"content": "hi"}, format="json").status_code, 403)

    def test_messages_are_sent_as_session_user(self):
        a, b = make_user("a@my.fisk.edu"), make_user("b@my.fisk.edu")
        self.login(a)
        conv_id = self.client.post("/api/conversations", {"other_user_id": b.id}, format="json").data[
            "conversation_id"
        ]
        response = self.client.post(
            f"/api/conversations/{conv_id}/messages", {"content": "hello", "sender_id": b.id}, format="json"
        )
        self.assertEqual(response.data["sender_id"], a.id)


class TutoringTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.calc = Course.objects.create(code="MATH 131", title="Calculus I")
        self.chem = Course.objects.create(code="CHEM 111", title="General Chemistry I")
        self.student = make_user()

        self.math_tutor = TutorProfile.objects.create(
            user=make_user("math@my.fisk.edu", major="Mathematics"),
            subjects="derivatives limits chain rule calculus",
            availability=["mon:evening"],
        )
        self.math_tutor.courses.add(self.calc)
        self.chem_tutor = TutorProfile.objects.create(
            user=make_user("chem@my.fisk.edu"), subjects="stoichiometry reactions", availability=["tue:morning"]
        )
        self.chem_tutor.courses.add(self.chem)
        self.login(self.student)

    def test_many_requests_in_same_subject_are_allowed(self):
        for _ in range(2):
            response = self.client.post(
                "/api/tutoring/requests",
                {"title": "Calc help", "description": "derivatives", "subject_area": "Math"},
                format="json",
            )
            self.assertEqual(response.status_code, 201)
        self.assertEqual(HelpRequest.objects.count(), 2)

    def test_matching_ranks_course_and_topic_fit_first(self):
        response = self.client.post(
            "/api/tutoring/requests",
            {
                "title": "Help with derivatives",
                "description": "I am stuck on the chain rule in calculus",
                "course_id": self.calc.id,
                "preferred_availability": ["mon:evening", "not-a-slot"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        matches = response.data["matches"]
        self.assertEqual(matches[0]["tutor"]["id"], self.math_tutor.id)
        self.assertIn("Tutors MATH 131", matches[0]["reasons"])
        self.assertEqual(response.data["request"]["preferred_availability"], ["mon:evening"])

    def test_student_is_never_matched_with_themselves(self):
        own = TutorProfile.objects.create(user=self.student, subjects="derivatives calculus chain rule")
        own.courses.add(self.calc)
        response = self.client.post(
            "/api/tutoring/requests",
            {"title": "derivatives", "description": "calculus chain rule", "course_id": self.calc.id},
            format="json",
        )
        self.assertNotIn(own.id, [m["tutor"]["id"] for m in response.data["matches"]])

    def test_accepting_match_opens_conversation(self):
        created = self.client.post(
            "/api/tutoring/requests",
            {"title": "derivatives", "description": "calculus", "course_id": self.calc.id},
            format="json",
        ).data
        match_id = created["matches"][0]["id"]
        response = self.client.post(f"/api/tutoring/matches/{match_id}/accept")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Conversation.objects.filter(id=response.data["conversation_id"]).exists())
        self.assertEqual(HelpRequest.objects.get().status, "matched")


class OrganizationTests(ApiTestCase):
    def test_join_leave_and_officer_only_events(self):
        org = Organization.objects.create(name="Fisk Coding Collective", category="academic")
        member = make_user()
        self.login(member)
        self.assertEqual(self.client.post(f"/api/organizations/{org.slug}/join").status_code, 200)
        response = self.client.post(
            f"/api/organizations/{org.slug}/events",
            {"title": "Hack night", "start_time": "2030-01-01T18:00:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

        org.memberships.filter(user=member).update(role="officer")
        response = self.client.post(
            f"/api/organizations/{org.slug}/events",
            {"title": "Hack night", "start_time": "2030-01-01T18:00:00"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.get(f"/api/organizations/{org.slug}").data["upcoming_events"][0]["title"], "Hack night")


class SearchTests(ApiTestCase):
    def test_grouped_results_and_reindex_after_save(self):
        self.login(make_user())
        Listing.objects.create(user=make_user("seller@my.fisk.edu"), title="Calculus textbook", price=40)
        response = self.client.get("/api/search?q=calculus textbook&min_score=0.1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data["results"]), set(search.TYPE_NAMES))
        self.assertEqual(response.data["results"]["listing"][0]["title"], "Calculus textbook")

        Organization.objects.create(name="Mathematics Club", description="calculus study sessions")
        response = self.client.get("/api/search?q=calculus&type=organization&min_score=0.1")
        self.assertEqual(response.data["results"]["organization"][0]["name"], "Mathematics Club")

    def test_rejects_unknown_type(self):
        self.login(make_user())
        self.assertEqual(self.client.get("/api/search?q=x&type=nope").status_code, 400)


class SeedDemoTests(ApiTestCase):
    def test_seed_is_idempotent(self):
        call_command("seed_demo", "--skip-search", stdout=StringIO())
        counts = (Account.objects.count(), Listing.objects.count(), Organization.objects.count())
        call_command("seed_demo", "--skip-search", stdout=StringIO())
        self.assertEqual(counts, (Account.objects.count(), Listing.objects.count(), Organization.objects.count()))
        self.assertTrue(all(u.email.endswith("@my.fisk.edu") for u in Account.objects.all()))

        call_command("seed_demo", "--reset", "--skip-search", stdout=StringIO())
        self.assertEqual(counts[0], Account.objects.count())
