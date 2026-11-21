"""
Fill the database with fictional demo data for every part of Fisk Central Hub.

Safe to run repeatedly. `--reset` first deletes everything marked as demo data
(accounts and organizations with is_demo=True, plus whatever they own).
All people, organizations, and events here are made up.
"""

from datetime import timedelta
from decimal import Decimal
from urllib.parse import quote_plus

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from backend import matching
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

DEMO_PASSWORD = "FiskHub-demo-2026"
DOMAIN = "my.fisk.edu"

COURSES = [
    ("MATH 131", "Calculus I"),
    ("MATH 132", "Calculus II"),
    ("MATH 241", "Linear Algebra"),
    ("BIOL 101", "General Biology"),
    ("CHEM 111", "General Chemistry I"),
    ("CHEM 231", "Organic Chemistry I"),
    ("PHYS 131", "General Physics I"),
    ("CSCI 110", "Introduction to Programming"),
    ("CSCI 210", "Data Structures"),
    ("ENGL 101", "Composition I"),
    ("PSYC 101", "Introduction to Psychology"),
    ("ECON 201", "Principles of Microeconomics"),
]

# username, name, major, class year, bio, courses taken
STUDENTS = [
    ("amara.j", "Amara Johnson", "Mathematics", 2026,
     "Math major who loves turning scary calculus problems into simple steps.",
     ["MATH 131", "MATH 132", "MATH 241", "PHYS 131"]),
    ("dlewis", "Darius Lewis", "Biology", 2027,
     "Pre-med biology major. Organic chemistry is my favorite puzzle.",
     ["BIOL 101", "CHEM 111", "CHEM 231"]),
    ("kwame.o", "Kwame Osei", "Computer Science", 2026,
     "CS major and TA for intro programming. Happy to debug with you.",
     ["CSCI 110", "CSCI 210", "MATH 241"]),
    ("nia.w", "Nia Williams", "English", 2027,
     "Writing center volunteer. I help with essays from outline to final draft.",
     ["ENGL 101", "PSYC 101"]),
    ("jbrooks", "Jordan Brooks", "Business Administration", 2026,
     "Business major, econ nerd, and spreadsheet enthusiast.",
     ["ECON 201", "PSYC 101", "MATH 131"]),
    ("tiana.m", "Tiana Moore", "Psychology", 2029,
     "First-year exploring psychology and campus life.", ["PSYC 101"]),
    ("marcus.h", "Marcus Hill", "Biology", 2029,
     "First-year, pre-nursing. Still figuring out calculus.", ["BIOL 101"]),
    ("simone.c", "Simone Carter", "Computer Science", 2028,
     "Sophomore learning data structures the hard way.", ["CSCI 110", "MATH 131"]),
    ("andre.p", "Andre Phillips", "Physics", 2028,
     "Physics major and intramural basketball captain.", ["PHYS 131", "MATH 131", "MATH 132"]),
    ("zoe.b", "Zoe Bennett", "Political Science", 2027,
     "Debate team member and campus service volunteer.", ["ENGL 101", "ECON 201"]),
]

# username, courses, subjects, availability
TUTORS = [
    ("amara.j", ["MATH 131", "MATH 132"],
     "Derivatives, limits, the chain rule, related rates, integrals, and exam prep for calculus.",
     ["mon:evening", "wed:evening", "thu:afternoon", "sun:afternoon"]),
    ("dlewis", ["CHEM 111", "CHEM 231", "BIOL 101"],
     "Stoichiometry, reaction mechanisms, functional groups, and writing lab reports.",
     ["tue:afternoon", "thu:afternoon", "sat:morning"]),
    ("kwame.o", ["CSCI 110", "CSCI 210", "MATH 241"],
     "Python and Java, debugging, recursion, linked lists, trees, and big-O analysis.",
     ["mon:afternoon", "wed:afternoon", "fri:afternoon"]),
    ("nia.w", ["ENGL 101"],
     "Essay structure, thesis statements, research papers, MLA and APA citations, and editing.",
     ["tue:evening", "wed:evening", "sun:evening"]),
    ("jbrooks", ["ECON 201"],
     "Supply and demand, elasticity, graph reading, and intro statistics for social sciences.",
     ["mon:morning", "thu:evening"]),
]

CATEGORIES = [
    ("Textbooks", "Course textbooks and study guides."),
    ("Dorm & Home", "Furniture, appliances, and decor for your room."),
    ("Electronics", "Laptops, calculators, headphones, and gadgets."),
    ("Clothing", "Apparel, shoes, and Fisk gear."),
    ("Tickets & Events", "Tickets to campus and Nashville events."),
    ("School Supplies", "Notebooks, lab gear, and everything else for class."),
]

# seller, title, category, price, condition, color, description
LISTINGS = [
    ("amara.j", "Calculus: Early Transcendentals (8th ed.)", "Textbooks", 45, "good", "",
     "Used for MATH 131 and 132. Some highlighting in chapters 2 and 3, otherwise clean."),
    ("dlewis", "Organic Chemistry textbook + solutions manual", "Textbooks", 60, "good", "",
     "Both books for CHEM 231. Solutions manual is barely used."),
    ("nia.w", "The Norton Field Guide to Writing", "Textbooks", 15, "like-new", "",
     "Required for ENGL 101. No markings."),
    ("jbrooks", "Principles of Microeconomics textbook", "Textbooks", 30, "fair", "",
     "ECON 201 book. Cover is worn but every page is there."),
    ("kwame.o", "Intro to Java Programming textbook", "Textbooks", 35, "good", "",
     "Used in CSCI 110 and still useful for CSCI 210."),
    ("tiana.m", "Mini fridge (3.1 cu ft)", "Dorm & Home", 70, "good", "Black",
     "Fits under a dorm desk. Freezer compartment works great. Pick up near Jubilee Hall."),
    ("marcus.h", "LED desk lamp with USB charging", "Dorm & Home", 18, "like-new", "White",
     "Three brightness levels, perfect for late-night studying."),
    ("zoe.b", "Twin XL sheet set and comforter", "Dorm & Home", 25, "like-new", "Navy",
     "Washed and folded. Fits standard dorm beds."),
    ("simone.c", "Microwave, 700W", "Dorm & Home", 35, "good", "Silver",
     "Compact microwave, works perfectly. Moving off campus next semester."),
    ("andre.p", "Storage ottoman", "Dorm & Home", 20, "good", "Gray",
     "Extra seating plus storage for snacks and shoes."),
    ("kwame.o", "TI-84 Plus graphing calculator", "Electronics", 55, "good", "Black",
     "Allowed on calculus and physics exams. Comes with a cover and new batteries."),
    ("simone.c", "Noise-cancelling headphones", "Electronics", 80, "like-new", "Black",
     "Great for studying in a loud dorm. Includes the case and cable."),
    ("andre.p", "27-inch monitor", "Electronics", 90, "good", "Black",
     "1080p monitor with HDMI cable. Makes coding and papers much easier."),
    ("jbrooks", "Fisk University hoodie (size M)", "Clothing", 22, "like-new", "Royal blue",
     "Official campus store hoodie, worn twice."),
    ("tiana.m", "Business casual blazer (size S)", "Clothing", 30, "like-new", "Black",
     "Good for career fair or presentations."),
    ("zoe.b", "Homecoming step show tickets (2)", "Tickets & Events", 40, "new", "",
     "Two tickets for the homecoming step show. Can't make it anymore."),
    ("andre.p", "Nashville Predators game ticket", "Tickets & Events", 35, "new", "",
     "One upper-level seat for next Saturday's game."),
    ("dlewis", "Lab coat and safety goggles", "School Supplies", 20, "good", "White",
     "Required for chemistry and biology labs. Size medium."),
    ("marcus.h", "Scientific notebook bundle (5 pack)", "School Supplies", 10, "new", "",
     "Unopened pack of graph-paper lab notebooks."),
    ("nia.w", "Planner and highlighter set", "School Supplies", 8, "new", "",
     "Academic-year planner plus a 12-color highlighter set."),
]

# name, category, description, contact
ORGANIZATIONS = [
    ("Pre-Health Professionals Society", "academic",
     "Support for students headed to medical, dental, nursing, and pharmacy school: MCAT study groups, "
     "shadowing connections, and application workshops.", "prehealth"),
    ("Fisk Coding Collective", "academic",
     "Students building software together. Weekly hack nights, interview prep, and hackathon teams. "
     "All majors and skill levels welcome.", "coding"),
    ("Mathematics & Physics Club", "academic",
     "Problem-solving sessions, guest speakers, and study groups for math and physics students.", "mathphys"),
    ("Caribbean & African Students Association", "cultural",
     "Celebrating Caribbean and African cultures through food, music, dance, and community events.", "casa"),
    ("Campus Service Corps", "service",
     "Volunteer projects across Nashville: tutoring local kids, food drives, and park cleanups.", "service"),
    ("Spoken Word & Poetry Collective", "arts",
     "Open mics, writing workshops, and performances for poets and storytellers.", "poetry"),
    ("Future Business Leaders Society", "professional",
     "Networking, resume reviews, and conversations with alumni in business and finance.", "business"),
    ("Intramural Sports League", "sports",
     "Basketball, flag football, and volleyball leagues open to every student.", "intramurals"),
]

# org name -> [(username, role)]
MEMBERSHIPS = {
    "Pre-Health Professionals Society": [("dlewis", "admin"), ("marcus.h", "member"), ("tiana.m", "member")],
    "Fisk Coding Collective": [("kwame.o", "admin"), ("simone.c", "officer"), ("andre.p", "member")],
    "Mathematics & Physics Club": [("amara.j", "admin"), ("andre.p", "officer"), ("marcus.h", "member")],
    "Caribbean & African Students Association": [("zoe.b", "officer"), ("kwame.o", "member"), ("nia.w", "member")],
    "Campus Service Corps": [("zoe.b", "admin"), ("tiana.m", "member"), ("jbrooks", "member")],
    "Spoken Word & Poetry Collective": [("nia.w", "admin"), ("tiana.m", "member")],
    "Future Business Leaders Society": [("jbrooks", "admin"), ("zoe.b", "member"), ("simone.c", "member")],
    "Intramural Sports League": [("andre.p", "admin"), ("jbrooks", "member"), ("marcus.h", "member")],
}

# org name, title, days from now, hour, duration hours, location, description
EVENTS = [
    ("Pre-Health Professionals Society", "MCAT study group kickoff", 3, 18, 2, "Science Building 210",
     "Meet your study group and get a 10-week MCAT plan."),
    ("Pre-Health Professionals Society", "Med school application workshop", 16, 17, 1.5, "Library Room B",
     "Personal statements, letters of recommendation, and timelines."),
    ("Fisk Coding Collective", "Hack night: build your first web app", 2, 19, 3, "Computer Lab 105",
     "Bring a laptop. We'll pair you with a mentor and ship something by the end of the night."),
    ("Fisk Coding Collective", "Technical interview practice", 9, 18, 2, "Computer Lab 105",
     "Mock coding interviews with feedback from upperclassmen who interned last summer."),
    ("Mathematics & Physics Club", "Calculus final exam review", 6, 18, 2, "Math Building 120",
     "Practice problems on derivatives, integrals, and related rates before finals."),
    ("Caribbean & African Students Association", "Culture night", 12, 19, 3, "Student Union Ballroom",
     "Food, music, and performances celebrating the diaspora."),
    ("Campus Service Corps", "Saturday food drive", 5, 10, 3, "Student Union Lobby",
     "Help sort and deliver donations to a local food bank."),
    ("Spoken Word & Poetry Collective", "Open mic night", 4, 20, 2, "Student Union Coffee House",
     "Sign up at the door to perform, or just come listen."),
    ("Future Business Leaders Society", "Alumni networking mixer", 14, 18, 2, "Business School Atrium",
     "Meet alumni working in finance, consulting, and entrepreneurship. Business casual."),
    ("Intramural Sports League", "3-on-3 basketball tournament", 7, 16, 4, "Gymnasium",
     "Sign up as a team or get placed on one when you arrive."),
    ("Fisk Coding Collective", "Intro to Git workshop", -10, 18, 1.5, "Computer Lab 105",
     "Version control basics for class projects."),
    ("Campus Service Corps", "Park cleanup", -20, 9, 3, "Centennial Park",
     "Our first service day of the semester."),
]

# student, title, course code, subject area, availability, description
HELP_REQUESTS = [
    ("marcus.h", "Help with calc derivatives before Friday's exam", "MATH 131", "Calculus",
     ["mon:evening", "wed:evening"],
     "I understand the power rule but get lost with the chain rule and product rule. "
     "Exam is Friday and I need someone to walk me through practice problems."),
    ("tiana.m", "Organic chemistry reaction mechanisms", "CHEM 231", "Chemistry",
     ["thu:afternoon", "sat:morning"],
     "Arrow pushing and SN1 vs SN2 reactions are confusing me. Looking for weekly help."),
    ("simone.c", "Recursion makes no sense to me", "CSCI 210", "Computer science",
     ["wed:afternoon", "fri:afternoon"],
     "I can't figure out how to trace recursive functions or write base cases for tree problems."),
    ("zoe.b", "Feedback on my argumentative essay", "ENGL 101", "Writing",
     ["tue:evening"],
     "I have a draft but my thesis feels weak. Would like someone to review structure and citations."),
]


# Photos live in client/public/listings/ so the demo works offline.
LISTING_PHOTOS = {
    "Calculus: Early Transcendentals (8th ed.)": "calculus-textbook.jpg",
    "Organic Chemistry textbook + solutions manual": "orgo-textbook.jpg",
    "The Norton Field Guide to Writing": "writing-guide.jpg",
    "Principles of Microeconomics textbook": "econ-textbook.jpg",
    "Intro to Java Programming textbook": "java-textbook.jpg",
    "Mini fridge (3.1 cu ft)": "mini-fridge.jpg",
    "LED desk lamp with USB charging": "desk-lamp.jpg",
    "Twin XL sheet set and comforter": "bedding.jpg",
    "Microwave, 700W": "microwave.jpg",
    "Storage ottoman": "ottoman.jpg",
    "TI-84 Plus graphing calculator": "graphing-calculator.jpg",
    "Noise-cancelling headphones": "headphones.jpg",
    "27-inch monitor": "monitor.jpg",
    "Fisk University hoodie (size M)": "fisk-hoodie.jpg",
    "Business casual blazer (size S)": "blazer.jpg",
    "Homecoming step show tickets (2)": "step-show-tickets.jpg",
    "Nashville Predators game ticket": "hockey-ticket.jpg",
    "Lab coat and safety goggles": "lab-coat.jpg",
    "Scientific notebook bundle (5 pack)": "notebooks.jpg",
    "Planner and highlighter set": "planner.jpg",
}


def listing_image(title):
    if title in LISTING_PHOTOS:
        return f"/listings/{LISTING_PHOTOS[title]}"
    return f"https://placehold.co/600x600/1e3a8a/c4a25a?text={quote_plus(title[:28])}"


class Command(BaseCommand):
    help = "Create fictional demo students, tutors, listings, organizations, events, and messages."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data first.")
        parser.add_argument(
            "--skip-search", action="store_true",
            help="Don't load the embedding model (skips tutor matching and index warm-up).",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            accounts, _ = Account.objects.filter(is_demo=True).delete()
            orgs, _ = Organization.objects.filter(is_demo=True).delete()
            self.stdout.write(f"Removed {accounts + orgs} demo records.")

        with transaction.atomic():
            courses = self.seed_courses()
            users = self.seed_students(courses)
            tutors = self.seed_tutors(users, courses)
            self.seed_listings(users)
            self.seed_organizations(users)
            requests = self.seed_help_requests(users, courses)
            self.seed_messages(users)

        if options["skip_search"]:
            self.stdout.write(self.style.WARNING("Skipped tutor matching and search indexing."))
        else:
            self.seed_matches(requests, tutors, users)
            call_command("build_search_index", stdout=self.stdout)

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo data ready. Log in as any demo student, e.g. marcus.h@{DOMAIN}, "
                f"with password {DEMO_PASSWORD}"
            )
        )

    def seed_courses(self):
        courses = {}
        for code, title in COURSES:
            courses[code], _ = Course.objects.update_or_create(code=code, defaults={"title": title})
        return courses

    def seed_students(self, courses):
        users = {}
        for username, name, major, year, bio, taken in STUDENTS:
            user, created = Account.objects.update_or_create(
                email=f"{username}@{DOMAIN}",
                defaults={
                    "username": username,
                    "name": name,
                    "major": major,
                    "class_year": year,
                    "bio": bio,
                    "email_verified": True,
                    "is_demo": True,
                },
            )
            if created or not user.check_password(DEMO_PASSWORD):
                user.set_password(DEMO_PASSWORD)
                user.save(update_fields=["password"])
            user.courses_taken.set([courses[c] for c in taken])
            users[username] = user
        self.stdout.write(f"{len(users)} students")
        return users

    def seed_tutors(self, users, courses):
        tutors = {}
        for username, codes, subjects, availability in TUTORS:
            profile, _ = TutorProfile.objects.update_or_create(
                user=users[username],
                defaults={"subjects": subjects, "availability": availability, "is_active": True},
            )
            profile.courses.set([courses[c] for c in codes])
            tutors[username] = profile
        self.stdout.write(f"{len(tutors)} tutors")
        return tutors

    def seed_listings(self, users):
        categories = {}
        for name, description in CATEGORIES:
            categories[name], _ = Category.objects.update_or_create(
                name=name, defaults={"description": description}
            )
        for seller, title, category, price, condition, color, description in LISTINGS:
            Listing.objects.update_or_create(
                user=users[seller],
                title=title,
                defaults={
                    "category": categories[category],
                    "price": Decimal(price),
                    "condition": condition,
                    "color": color,
                    "description": description,
                    "image": listing_image(title),
                    "is_sold": False,
                },
            )
        self.stdout.write(f"{len(LISTINGS)} listings")

    def seed_organizations(self, users):
        orgs = {}
        for name, category, description, contact in ORGANIZATIONS:
            orgs[name], _ = Organization.objects.update_or_create(
                name=name,
                defaults={
                    "category": category,
                    "description": description,
                    "contact_email": f"{contact}.demo@{DOMAIN}",
                    "image": f"/organizations/{contact}.jpg",
                    "is_demo": True,
                },
            )
        for org_name, members in MEMBERSHIPS.items():
            for username, role in members:
                Membership.objects.update_or_create(
                    user=users[username], organization=orgs[org_name], defaults={"role": role}
                )

        today = timezone.localtime().replace(minute=0, second=0, microsecond=0)
        for org_name, title, days, hour, hours, location, description in EVENTS:
            start = (today + timedelta(days=days)).replace(hour=hour)
            Event.objects.update_or_create(
                organization=orgs[org_name],
                title=title,
                defaults={
                    "start_time": start,
                    "end_time": start + timedelta(hours=hours),
                    "location": location,
                    "description": description,
                },
            )
        self.stdout.write(f"{len(orgs)} organizations, {len(EVENTS)} events")

    def seed_help_requests(self, users, courses):
        requests = {}
        for username, title, code, subject, availability, description in HELP_REQUESTS:
            requests[title], _ = HelpRequest.objects.update_or_create(
                user=users[username],
                title=title,
                defaults={
                    "course": courses[code],
                    "subject_area": subject,
                    "preferred_availability": availability,
                    "description": description,
                },
            )
        self.stdout.write(f"{len(requests)} help requests")
        return requests

    def seed_matches(self, requests, tutors, users):
        try:
            for help_request in requests.values():
                matching.refresh_matches(help_request)
        except OSError as exc:
            self.stdout.write(self.style.WARNING(f"Skipped tutor matching (embedding model unavailable): {exc}"))
            return

        # One request already accepted, one closed, so every status shows up in the demo.
        calc = requests["Help with calc derivatives before Friday's exam"]
        accepted, _ = TutorMatch.objects.get_or_create(
            request=calc, tutor=tutors["amara.j"], defaults={"score": 0.9}
        )
        accepted.status = "accepted"
        accepted.save(update_fields=["status"])
        calc.status = "matched"
        calc.save(update_fields=["status"])
        self._thread(users["marcus.h"], users["amara.j"], [
            ("marcus.h", "Hi Amara! I accepted your match. Could we meet Wednesday evening?"),
            ("amara.j", "Of course! Library study room at 7? Bring your practice exam."),
            ("marcus.h", "Perfect, see you then."),
        ])

        essay = requests["Feedback on my argumentative essay"]
        essay.status = "closed"
        essay.save(update_fields=["status"])
        self.stdout.write("Tutor matches computed")

    def seed_messages(self, users):
        self._thread(users["tiana.m"], users["amara.j"], [
            ("tiana.m", "Hi! Is the calculus textbook still available?"),
            ("amara.j", "Yes it is! I can meet at the Student Union tomorrow afternoon."),
            ("tiana.m", "Great, would you take $40?"),
        ])
        self._thread(users["andre.p"], users["kwame.o"], [
            ("andre.p", "Hey, does the TI-84 come with a charging cable?"),
            ("kwame.o", "It uses AAA batteries, and I'm including a fresh set."),
        ])

    def _thread(self, user_a, user_b, lines):
        low, high = sorted([user_a.id, user_b.id])
        conversation, _ = Conversation.objects.get_or_create(user_one_id=low, user_two_id=high)
        if conversation.messages.exists():
            return
        people = {user_a.username: user_a, user_b.username: user_b}
        for username, content in lines:
            Message.objects.create(conversation=conversation, sender=people[username], content=content)
