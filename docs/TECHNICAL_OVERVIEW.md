# Fisk Central Hub: Technical Overview

## 1. Introduction

Fisk Central Hub is a web platform for Fisk University students that brings three campus needs together: finding and joining student organizations, buying and selling items in a peer marketplace, and getting matched with peer tutors. This document introduces the methods and technologies we use to build it, explains why each was chosen, and describes how the pieces fit together.

The project has three technical goals:

1. **Trust.** Only verified Fisk students can use the platform, so every buyer, seller, tutor, and organization member is a real classmate.
2. **Intent-based search.** Students should be able to describe what they need in their own words ("something to keep drinks cold in my dorm", "someone who can explain recursion") and get relevant results, even when their wording doesn't match the listing or profile exactly.
3. **Useful matching.** Tutoring requests should be paired with the tutors most likely to help, based on what the student described, the course, and when both people are free.

## 2. System architecture

The platform uses a standard three-layer web architecture:

```
 Browser (React single-page app)
        │  JSON over HTTPS, session cookie + CSRF token
        ▼
 Django REST API  ──────────►  Search & matching service (in-process)
        │                         sentence-transformers + FAISS
        ▼
 Relational database (SQLite in development, PostgreSQL in production)
```

- **Frontend:** a React single-page application that handles all screens and talks to the backend only through a JSON API.
- **Backend:** a Django application that exposes a REST API under `/api/`, enforces authentication and permissions, and stores data.
- **Search and matching:** a Python module inside the backend that turns text into embeddings and searches them with FAISS.
- **Database:** a relational database accessed through Django's object-relational mapper (ORM).

In development, the Vite dev server proxies `/api` requests to Django, so the frontend and API share one origin. That keeps cookies and CSRF protection simple and avoids cross-origin issues.

## 3. Technology stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend framework | React 19 with TypeScript 5.8 | Component-based UI with static type checking |
| Build tool | Vite 7 | Fast development server and production builds |
| Styling | Tailwind CSS 4 | Utility-first styling with a shared Fisk blue and gold theme |
| Routing | React Router 7 | Client-side pages such as `/marketplace` and `/tutoring` |
| HTTP client | Axios | API calls with cookies and CSRF headers attached |
| Backend framework | Django 5.2 | Data models, authentication, admin site, migrations |
| API layer | Django REST Framework 3.16 | JSON endpoints, permission checks, request parsing |
| Database | SQLite (development), PostgreSQL (planned production) | Persistent storage for users, listings, organizations, and more |
| Embedding model | sentence-transformers, `all-MiniLM-L6-v2` | Converts text into 384-dimensional vectors that capture meaning |
| Vector search | FAISS (`faiss-cpu`) | Fast similarity search over embeddings |
| Numerical computing | NumPy | Vector math for similarity scores |
| Testing | Django test runner, ESLint, TypeScript compiler | Backend tests, code quality, and type checks |
| Version control | Git | Change tracking and collaboration |

### Why these choices

- **Django and Django REST Framework** come with secure defaults: hashed passwords, session management, CSRF protection, and an admin site for moderation. That lets us spend our time on features instead of security plumbing. Python is also the main language for machine learning, so search and matching run in the same codebase as the API.
- **React with TypeScript** suits a platform with many interactive screens, such as live join and leave buttons, carts, and messaging. TypeScript catches mismatches between the frontend and the API's data shapes before they reach users.
- **Tailwind CSS** keeps the design consistent across pages and makes the Fisk color theme easy to change in one place.
- **sentence-transformers with MiniLM** is small (about 90 MB), fast on an ordinary laptop CPU (under 100 ms per query), and trained specifically for semantic similarity. We tested a larger model, `BAAI/bge-m3`, and it was slower without giving better results for short student queries.
- **FAISS** is an industry-standard library for similarity search. At campus scale it returns exact results in milliseconds, and it can switch to approximate indexes if the platform grows.

## 4. Data model

The core data is stored in relational tables managed by Django migrations.

| Entity | Key fields | Notes |
| --- | --- | --- |
| Account | Fisk email, name, major, class year, bio, courses taken, `email_verified` | Custom user model. Email is the login. |
| Listing | Seller, title, description, price, category, condition, image, `is_sold` | Marketplace items |
| Category | Name, description | Textbooks, Dorm & Home, Electronics, and so on |
| Organization | Name, slug, category, description, contact email, image | Student organizations |
| Membership | User, organization, role (member, officer, admin) | One membership per user per organization |
| Event | Organization, title, description, location, start and end time | Officers and admins create events |
| Course | Code, title | For example, `MATH 131 Calculus I` |
| TutorProfile | User, courses, subjects, weekly availability, active flag | One profile per tutor |
| HelpRequest | Student, course, subject area, description, preferred times, status | Open, matched, or closed |
| TutorMatch | Request, tutor, score, reasons, status | Proposed, accepted, or declined |
| Conversation and Message | Two participants, message text, timestamps | Direct messages between students |

Availability is stored as a list of weekly time slots in the form `day:period`, such as `mon:evening` or `thu:afternoon`. A simple shared format makes it easy to compare a student's free times with a tutor's.

## 5. Methods

### 5.1 Verified trust layer

Every account must use a `@my.fisk.edu` email address. The check runs on both the frontend, for instant feedback, and the backend, where it is enforced. Registration follows a standard email-verification flow:

1. The student signs up with their Fisk email and a password. Django stores only a salted hash of the password (PBKDF2).
2. The backend generates a one-time, time-limited verification token with Django's built-in token generator and emails a link to the student.
3. Clicking the link marks the account as verified. Unverified accounts cannot log in.

After login, Django issues a secure session cookie. Every request that changes data must also include a CSRF token, which blocks cross-site request forgery. Permission checks always use the logged-in user from the session, never a user ID sent by the browser, so one student cannot act as another. For example, only the seller can edit a listing, only participants can read a conversation, and only officers can post events for their organization.

For live presentations, a configurable **demo mode** (`DEMO_LOGIN`) lets any `@my.fisk.edu` address log in without registering first. It still rejects non-Fisk emails. Demo mode is meant only for demonstrations and is turned off for real use.

### 5.2 Semantic search with embeddings

Traditional keyword search fails when students and sellers use different words: "calc" versus "Calculus", or "keep drinks cold" versus "mini fridge". We solve this with **semantic search**:

1. **Text representation.** Each searchable item is turned into a short descriptive text. A listing combines its title, description, category, condition, and color. A tutor combines their courses, subjects, major, and bio. An organization combines its name, category, and description. An event combines its title, description, host, and location.
2. **Embedding.** The MiniLM model converts each text into a 384-dimensional vector. Texts with similar meanings produce vectors that point in similar directions.
3. **Normalization.** Every vector is scaled to length 1, so the inner product of two vectors equals their **cosine similarity**:

   \[
   \text{cosine}(a, b) = \frac{a \cdot b}{\lVert a \rVert \, \lVert b \rVert}
   \]

   Scores range from -1 to 1, and higher means more similar.
4. **Indexing.** Each content type (listings, tutors, organizations, events) gets its own FAISS `IndexFlatIP` index, which performs exact inner-product search.
5. **Querying.** The student's query is embedded with the same model and compared against the index. Results below a minimum similarity of 0.2 are dropped, and the top results for each type are returned.

**Keeping results current.** Whenever a listing, profile, organization, or event is created, edited, or deleted, Django signals mark the matching index as out of date. The next search rebuilds it. At campus scale, a rebuild takes about a second, so new content becomes searchable without restarting the server.

### 5.3 Tutor matching

When a student submits a help request, the system ranks every active tutor with a weighted score:

\[
\text{score} = 0.60 \times \text{semantic} + 0.25 \times \text{course} + 0.15 \times \text{availability}
\]

- **Semantic similarity (60%)** is the cosine similarity between the request text (course, title, description, and subject) and the tutor's profile text. It captures what the student is actually struggling with.
- **Course match (25%)** is 1 if the tutor lists the requested course and 0 otherwise.
- **Availability overlap (15%)** is the share of the student's preferred time slots that the tutor also has free.

Students are never matched with themselves. Matches scoring below 0.25 are discarded, and the top five are saved. Each match comes with plain-language reasons, such as "Tutors MATH 131" or "Available Mon evening, Wed evening", so students understand why a tutor was suggested. When a student accepts a match, the request is marked as matched and a conversation with the tutor opens automatically.

The weights favor meaning over exact course codes, because students often describe topics ("chain rule", "SN1 vs SN2 reactions") rather than course numbers. They are a starting point, and we plan to tune them based on which matches students accept.

### 5.4 Organizations, events, and the marketplace

These features use standard create, read, update, and delete (CRUD) operations over the REST API, with role-based permissions:

- Students can join or leave organizations. The last admin of an organization cannot leave, so an organization is never left without an admin.
- Officers and admins can create and edit events for their organization. Students can filter events to only the organizations they belong to.
- Sellers can post, edit, mark as sold, and delete their own listings. Buyers contact sellers through built-in messaging and arrange pickup on campus. The platform does not process payments.

## 6. Development methodology

We follow an **iterative, phase-based process**, delivering one working feature area at a time:

1. **Design.** Low-fidelity wireframes for the main screens (landing page, organization search, marketplace, and tutoring), kept in `docs/wireframes/`.
2. **Foundation.** The verified-account system, sessions, and security settings.
3. **Features.** Tutoring, then organizations and events, then unified search and matching.
4. **Demo data.** A `seed_demo` command creates realistic sample students, courses, tutors, listings, organizations, events, and conversations, so the platform can be demonstrated and tested with believable content.
5. **Polish and testing.** Branding, browser-based quality assurance, and bug fixes.

### Testing and quality

- **Automated backend tests** cover registration and verification, domain restrictions, demo login, access control, tutoring and matching, organization roles, search, and the demo-data command. Tests swap in a small fake embedding model so they run quickly and offline.
- **Static checks** run on the frontend: the TypeScript compiler checks types, and ESLint checks code quality.
- **Manual and browser-based testing** walks through key user flows, such as logging in, searching, joining an organization, messaging a seller, and creating a listing.

## 7. Deployment plan

- **Configuration** comes from environment variables: secret key, debug mode, allowed hosts, email server, demo mode, and allowed email domains. That way the same code runs in development and production without edits.
- **Database:** SQLite during development. PostgreSQL in production for reliability under many simultaneous users.
- **Email:** emails print to the console in development. In production, a real SMTP provider sends verification emails.
- **Hosting:** the React app is built into static files and served alongside the Django API on a single domain over HTTPS, with secure cookie settings turned on.
- **Search model:** the embedding model is downloaded once and cached on the server. It loads on the first search rather than at startup.

## 8. Evaluation

We will judge the platform on:

- **Search relevance:** whether the expected result appears in the top three for a set of realistic student queries. With the demo data, each sample tutoring request already ranks the expected tutor first, with match scores between 0.68 and 0.77.
- **Match acceptance rate:** the share of proposed tutor matches that students accept.
- **Performance:** search responses under one second on ordinary hardware.
- **Security:** non-Fisk emails rejected, unverified accounts blocked, and students unable to read or change other students' data. All of these are covered by automated tests.
- **Usability:** feedback from student testers during a pilot.

## 9. Risks and future work

| Risk or limitation | Plan |
| --- | --- |
| Exact course codes like "CHEM 231" can rank below looser semantic matches | Add hybrid search that combines keyword matching (BM25) with embeddings |
| Similarity thresholds and matching weights are hand-tuned | Adjust them using pilot data on searches and accepted matches |
| In-memory indexes rebuild fully after each change | Fine at campus scale. Past about 10,000 items per type, switch to an approximate FAISS index and save indexes to disk. |
| Messaging refreshes by polling every few seconds | Move to WebSockets for real-time chat |
| Listing photos are entered as links | Add direct photo uploads with cloud storage, and possibly image-based search |
