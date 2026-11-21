# Semantic Search and Tutor Matching

## Overview

Fisk Central Hub's main differentiator is intent-based search: students describe what they need in their own words, and the system finds results that match the meaning rather than exact keywords. A search for "help with calc derivatives" surfaces the Calculus I tutor even though no profile contains the word "calc."

The same embeddings power three things:

1. **Global search** across tutors, marketplace listings, organizations, and upcoming events (`GET /api/search`).
2. **In-page search** on the Marketplace and Organizations pages.
3. **Tutor matching**, which combines semantic similarity with structured signals (course and availability) to rank tutors for a help request.

Search began as a product-only feature in the original Bulldog Marketplace. This write-up covers how it was generalized for the full hub, and keeps the lessons from the first version.

## How it works

### Embedding model

All text is embedded with `sentence-transformers/all-MiniLM-L6-v2`:

- 384-dimensional embeddings, small and fast (about 90 MB, under 100 ms per query on a laptop CPU)
- Trained for semantic similarity, so it works well out of the box
- Embeddings are L2-normalized, so the inner product of two vectors equals their cosine similarity

The model loads lazily on the first search, not when Django starts, so commands like `migrate` stay fast. `SEARCH_MODEL_NAME` in settings can swap in a different model.

### One index per content type

`src/backend/search.py` keeps a registry of searchable types. Each type defines which rows to index and how to turn a row into text:

| Type | Rows indexed | Text that gets embedded |
| --- | --- | --- |
| `listing` | Unsold listings | Title, description, category, condition, color |
| `tutor` | Active tutor profiles | "Tutor for MATH 131 Calculus I, ...", topics, major, bio |
| `organization` | All organizations | Name, category, description |
| `event` | Upcoming events | Title, description, host organization, location |

Each type gets its own in-memory `faiss.IndexFlatIP` (exact inner-product search). Separate indexes keep result groups clean and let each page search only what it needs (`?type=listing`, for example).

### Keeping indexes fresh

The first version needed a manual `build_product_index` command and a server restart after every change. Now:

- `signals.py` listens for saves and deletes on every model that feeds an index. That includes indirect ones: editing an account's major changes tutor text, and changing a tutor's courses fires `m2m_changed`.
- A signal only marks the affected index as stale. The next search rebuilds it.
- At campus scale (hundreds of rows per type), a full rebuild takes about a second or less on a laptop CPU, so incremental updates aren't needed yet.

### Search API

```
GET /api/search?q=<text>&type=all|listing|tutor|organization|event&k=8&min_score=0.2
```

Returns `{"query": ..., "results": {"tutor": [...], "listing": [...], ...}}`. Each item uses the same shape as its regular endpoint, plus a `score`.

- `k` (default 8, max 50) is the number of results per type.
- `min_score` (default `SEARCH_MIN_SCORE` = 0.2) drops weak matches.

### Tutor matching

`src/backend/matching.py` ranks active tutors for a help request:

```
score = 0.60 × semantic similarity(request text, tutor text)
      + 0.25 × course match        (1 if the tutor lists the requested course)
      + 0.15 × availability overlap (share of the student's free slots the tutor also has)
```

- Request text combines the course, title, description, and subject area.
- Students are never matched with themselves, and inactive tutors are skipped.
- Matches under 0.25 are dropped, and the top 5 are saved as `TutorMatch` rows with human-readable reasons, such as "Tutors MATH 131", "Profile closely matches what you described", and "Available Mon evening, Wed evening".
- Accepting a match marks the request as matched and opens a conversation with the tutor.

With the demo data, each sample request ranks the expected tutor first, with scores between 0.68 and 0.77.

## Lessons learned

These came from the original product search and still shape the design.

**Identical results for every query.** The first endpoint returned `k=20` results from a catalog of about 20 products, so every search returned the whole catalog. The fix was a smaller `k` and a minimum similarity threshold.

**Thin text gives weak matches.** Many listings had empty descriptions, and embedding only the title gave poor results. Combining several fields (category, condition, and so on) gives the model enough context. Tutor text follows the same idea.

**Bigger models aren't automatically better.** `BAAI/bge-m3` was tried first and underperformed for short, dense-only queries while being much larger and slower. MiniLM was the better fit.

**Thresholds depend on the queries.** Casual student phrasing like "calc" scores lower than formal text. "help with calc derivatives" against the Calculus tutor scores about 0.29 cosine similarity, while unrelated tutors score about 0.11. The default threshold was lowered from 0.35 to 0.2 so slang still finds the right results.

## Trying it

```bash
cd src
python manage.py seed_demo
python manage.py build_search_index --query "help with calc derivatives"
python manage.py build_search_index --type listing --query "something to keep drinks cold in my dorm"
```

`build_search_index` prints the top results and their scores for each type, which is handy when tuning thresholds.

The backend tests in `src/backend/tests.py` swap in a tiny bag-of-words encoder (`search.set_encoder`), so they run offline without downloading the model.

## Next steps

- **Hybrid search:** add keyword matching (BM25) so exact course codes and names like "CHEM 231" always rank highly.
- **Search analytics:** log queries that return nothing to find gaps, such as tutoring subjects with no tutors.
- **Tune with pilot feedback:** adjust `SEARCH_MIN_SCORE` and the matching weights based on which matches students accept.
- **Scale:** past roughly 10,000 items per type, switch to an approximate index like `IndexIVFFlat` and persist indexes to disk.
- **Multi-modal search:** embed listing photos so students can search by image.
