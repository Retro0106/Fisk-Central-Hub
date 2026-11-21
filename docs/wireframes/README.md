# Wireframes

Low-fidelity sketches of the core flows from the Fisk Central Hub proposal. They show layout and the order of screens, not final colors or styling. The built pages in `client/src/pages/` follow these layouts.

| File | Flow | Built as |
| --- | --- | --- |
| [01-landing-and-hub.svg](01-landing-and-hub.svg) | Landing and login, Fisk email verification, Hub home | `Landing.tsx`, `Register.tsx`, `VerifyEmail.tsx`, `Home.tsx` |
| [02-organization-search.svg](02-organization-search.svg) | Search orgs by interest, org page with join and events, all events | `Organizations.tsx`, `OrganizationDetail.tsx` |
| [03-marketplace-listing.svg](03-marketplace-listing.svg) | Browse with semantic search, item detail, message the seller | `Marketplace.tsx`, `ListingDetail.tsx`, `NewListing.tsx`, `Messages.tsx` |
| [04-tutor-request.svg](04-tutor-request.svg) | Request help, ranked tutor matches with reasons, chat, become a tutor | `RequestHelp.tsx`, `RequestDetail.tsx`, `TutorProfileForm.tsx` |

## Flow notes

**Organization search.** Students type an interest ("volunteering", "coding") instead of needing an organization's exact name. Category chips narrow the list. An organization page shows what it does, who's in it, and what's coming up. Officers and admins see a "Post event" button.

**Marketplace listing.** The search box accepts descriptions ("something to keep drinks cold in my dorm"). Every seller is a verified Fisk student, shown on the item page. Buying starts with a message to the seller, with a draft filled in from the listing. Sellers see "Mark as sold" and "Delete" on their own items.

**Tutor request.** Students describe the problem in their own words, optionally pick a course and the times they're free, and get ranked tutors. Each match explains itself ("Tutors MATH 131", "Available Mon evening") so students can trust the ranking. Accepting a match opens a chat with the tutor.

## Editing

The files are plain SVG. Open them in a browser to view, or edit them in Figma, Inkscape, or a text editor.
