# NSE — Release handoff and migration status (2026-11-04)

## Current verified state — Work continuation

This is a continuation of the existing development branch and PR #1. **Live staging deployment; not ready for staff acceptance.** No merge to `main`.

- Dedicated Supabase project **NSE-Staging**, ref `btehppfdtnajzmxtdhzk`, organization **Electronic System QIB** (`urvtectymucevnafswah`), Singapore. Confirmed healthy through the signed-in second account. No changes to Masar or the existing sterilization project.
- Second Render workspace verified in browser: **Apexa5551's workspace**, `tea-dbiu3aetlv9c73bnilt0`. The connectors remain attached to the first accounts; do not use those connector contexts for NSE mutations.
- Existing schemas were inspected (no application tables); corrected a literal `\n` syntax defect in `deploy/schema.sql`; applied the dedicated schema and restricted archive in the new project only.
- A read-only workbook export of the actual Google Sheets source was obtained through its view-only browser session. No Apps Script endpoint was called, since the old request handler writes activity logs even for read actions. No source sheet edits.
- **All 16 source sheets are accounted for, including empty sheets. 11,491 nonempty source rows were imported:**

| Source | Rows |
| --- | ---: |
| Specialties | 8 |
| Tools | 443 |
| Procedures | 300 |
| IPC_Modules | 10 |
| IPC_Steps | 88 |
| Quizzes | 132 |
| AssessmentBank | 0 |
| AssessmentConfig | 11 |
| Doctors | 23 |
| DoctorPrefs | 21 |
| Users (restricted archive only) | 38 |
| AssessmentResults | 39 |
| NurseProgress | 0 |
| DrillProgress | 58 |
| Mastery | 11 |
| Logs | 10,309 |

- The migration's database transaction checked every source count for exact equality, including zero counts, and saved a receipt in `qib.migration_runs`. Catalog total: 1,036. History archive total: 10,455. This is an archived migration, **not activation of 38 Supabase Auth accounts**.
- Source IDs, curated tool/consumable associations, images and multilingual values were retained. Unnamed but populated source columns in 208 procedure rows were preserved in `_sourceColumnsWithoutHeader` instead of discarded.
- **81 pre-existing unresolved links** are recorded in `qib.migration_issues`: 80 missing tool associations across 50 procedures, plus one doctor-preference reference. No guessed substitutions. Default strict catalog importer still rejects missing tool references; the separate staging builder explicitly preserves and flags them. Draft exam generation excludes unresolved procedure records; the checklist shows missing items explicitly.
- No legacy passwords or tokens were imported. Staff identity/center reconciliation and Supabase Auth onboarding are still pending; old usernames must only be linked after owner verification.
- Stored source translations are incomplete: Urdu/Indonesian names missing for all 8 specialties, all 300 procedures and all 10 IPC modules; 195 tool rows lack Urdu/Indonesian name/use; all 88 IPC steps lack those translations. Arabic has 12 missing tool names and 4 missing procedure names. Do not describe fallback English as completed translation.
- Added light/day theme and improved dark contrast, focus controls and mobile styles in `v2/live-theme.css`. Full live browser QA is still pending.
- Fixed stale assessment connection checks, missing heartbeat selection at restart, heartbeat reset on supervisor resume, attempted center-switch state drift, global specialty mutation authorization and owner-only legacy mapping. Global legacy identity uniqueness prevents linking one historical identity to multiple centers.
- `/health` now verifies database readiness. PG environment variables are supported as an alternative to a connection URL so the user can enter an existing database password directly without exposing it in chat. TLS verification remains enabled.
- Added pinned lockfile and PostgreSQL-backed tests against the actual API routes, plus execution of generated migration SQL with synthetic data. **48 automated tests passed locally.** These do not replace signed-in Supabase/Render end-to-end acceptance.
- Render service **nse-staging**, `srv-dbll3bh5efls73e348lg`, is deployed at **https://nse-staging.onrender.com/** on the existing development branch. Free plan, Singapore, manual deploys, repository-root build `npm ci --prefix api --omit=dev`, start `node api/server.js`, readiness path `/health`.
- Initial deployment correctly refused the untrusted database certificate (`SELF_SIGNED_CERT_IN_CHAIN`). Added the official Supabase Root 2021 CA from the project's Database Settings as `DB_SSL_CA`, preserving `rejectUnauthorized: true`. The corrected deployment `dep-dbll7bvajb4s739cu25g` reached **Live**, and external `/health` returned `200` with `status: ready`.
- External unauthenticated probes to `/api/catalog`, `/api/exams`, `/api/my-centers` returned **401**; `/api/config` returned only the project URL and publishable key. No staff data or question bank exposed.
- Pinned Node to `22.x` to match CI rather than letting the unbounded old range select a new major runtime.
- Added the pinned Supabase browser SDK served by the application, automatic session refresh/restore, invitation/recovery password setup and proper sign-out. The API also checks verified JWT `session_id` against `auth.sessions`, preventing a revoked session from reusing its access token. Deployed commit `e8f1d0777422f5f29b7c016f0ab4d78087f4848c` reached Live in deploy `dep-dbllarh5efls73e3oou0`. Public sign-in UI and the bundled SDK load correctly; signed-in acceptance is still pending.
- The dedicated project has no application Auth users yet. The next user handoff is **creation of their own initial application account**, entering the new email/password themselves. After user confirmation, verify the resulting UUID and bootstrap only that confirmed identity as platform owner; never promote an inferred staff identity.


## Remaining acceptance gates

1. Verify sign-in, refresh/recovery/invitation callbacks with the confirmed initial owner. The Site URL was saved as `https://nse-staging.onrender.com/`. TLS database connectivity and unauthenticated live checks have passed; authenticated acceptance has not.
2. Establish the owner's application Auth identity, bootstrap authorized centers, then reconcile staff identities, centers, specialties and roles from verified information. Existing source users have no email/center columns; do not invent those mappings or reuse their passwords.
3. Complete four-language interface/content coverage and clinical translation review. Build out and verify the remaining practical evaluation, training plan, notification, simulation, certificate verification/revocation and content review workflows; some base tables exist but are not yet complete end-to-end products.
4. Review source integrity issues with the owner and clinical reviewer. Preserve missing IDs until an explicit, documented repair is approved in NSE. Do not modify the legacy source.
5. Review and approve English-only assessment drafts before any official publication. The source AssessmentBank sheet is empty; existing Quizzes were preserved and are now included as draft candidates by specialty/group.
6. Complete deployed multi-role and multi-center acceptance, mobile/tablet/desktop checks, certificates and practical approval tests, image availability/migration and load testing. Remain on the development branch until all acceptance gates pass.

---

The original implementation inventory follows. The deployment/migration blocker list below is superseded by the verified state and remaining gates above.


## Approved target
**NSE — Nursing Skills & Education**. Training content: Arabic, English, Urdu, Indonesian. Official quizzes, clinical drills, tray assessments and exams: **English only**. No anti-cheating accusation in the user interface; interruption means **Assessment Paused** / **Session Review**.

## Canonical source
The original training platform uses **Google Sheets through Google Apps Script**. Inline HTML `seed-data` is a fallback and **NOT the actual total**. Never invent the counts or overwrite source curated mappings. Preserve all procedure `toolIds`, `consumableIds` and tool classifications. Preserve all source specialty IDs, languages, tool metadata, IPC steps and image/video URLs. Original live Apps Script was **not modified** by this branch.

## New implementation
- `v2/live.html` + `v2/live.js`: responsive authenticated UI; center selector, learning library, clinical skills studio, imported tools/procedures with curated tray checklists, IPC content and steps, English clinical assessments, skills growth journey, knowledge/competency cards, nurse invitation/assignment, content studio, center analytics, reviewed specialty exam authoring and private historic-results display.
- `api/server.js`: Node/Render service; Supabase Auth JWT verification, role+center checks; server-side exam questions/grade, attempt heartbeat and paused review; curated catalog, skill observations, card eligibility, controlled staff invitations and verified legacy identity linking.
- `api/build-specialty-exam.js`: English question drafts based on existing question bank and/or actual English tool uses and curated procedure lists; no official publication without explicit clinical review.
- `deploy/schema.sql` and `deploy/legacy-catalog.sql`: NSE-only database schema plus restricted legacy catalog/history archive and reviewer audit.
- `deploy/NSE-export-from-legacy.gs`: owner-run read-only full Sheets export, excluding password fields and legacy tokens.
- `deploy/import-catalog.js`: dry-run checks all **actual live exported counts**, refuses duplicate/missing curated associations, imports all source IDs and JSON; no fixed demo limits.
- `deploy/import-history.js`: separate secure archive of older staff assessment results and learning progression **without passwords**; later bind legacy usernames to verified Supabase Auth identities.
- `test/*.test.js` and `.github/workflows/qib-v2-ci.yml`: automated isolated tests.

## Critical deployment blockers — DO NOT claim released
1. The connected Supabase session still showed only **Masar-Production** and another older project. User explicitly **forbade using Masar-Production or its organization**. Obtain access to the **second dedicated Supabase account** before creating an NSE project. Never repurpose an existing database.
2. User has a second Render account. Do not deploy NSE in an unapproved existing workspace; connect/confirm the second workspace.
3. Actual Google Sheets data has **not been exported or imported** into NSE. The seed JSON is not complete; do not treat it as a snapshot.
4. Run `deploy/schema.sql` then `deploy/legacy-catalog.sql` on the new project, create staff Auth, verify protected row policies and database role privileges, import real catalog using a private owner export, validate real source counts and spot-check procedure associations, import historical archive and perform verified identity mapping.
5. Review full clinical accuracy and exam answer keys; import or approve specialty question drafts; perform staging E2E for multi-center isolation, switching, session interruption, result scoring and card issuance. Deploy secrets via Render environment variables only.
6. Image storage/migration, QR certificate verification/revocation, content editor review stages, full virtual clinic interaction parity, comprehensive localized UI, sign-in/session refresh and production-grade load testing still need staged verification/completion.
7. The prototype (`/demo`) is separate from the connected operational UI (`/`). Do not merge to `main` or expose staff to this branch until rollout acceptance.

## Release safety
- No writes to existing Apps Script, Google Sheets, original site, or Masar production.
- No source sheet IDs, passwords, secret keys or API tokens in public repositories.
- React seed numbers never drive official live KPIs.
- The badges are motivational; Knowledge/Competency cards are server-restricted learning records, not professional licensing.
- Clinical supervisors must approve practical competency before issuance.

## 2026-11-05 — Owner activation and growth interface

- User created and confirmed their initial Auth identity; after explicit approval it was added to `qib.platform_owners`. Browser SQL verification returned `owner_enabled=true`. No passwords were retrieved.
- Authenticated staging sign-in succeeded. Created the first independent staging center, `NSE — Training Center`, through the application's owner-only setup flow. Catalog browser check showed 8 specialties, 443 tools/consumables and 300 procedures.
- Implemented the mint learning direction across the shared operational UI, a split sign-in screen, locally authored SVG journey illustration, navigation/KPI icons, responsive layout and dark palette. The live home journey derives module/exam counts from authenticated state and does not invent completions.
- Added `/preview`: explicitly labeled fictional nurse/admin role preview with no Auth SDK, no API calls and disabled credential fields. Its example KPI values are not live performance data. This is a visual preview, not a substitute for real multi-role acceptance.
- Existing 48 automated tests pass after the interface changes. Deployment and browser verification of this interface revision must be recorded after successful release.
- Legacy staff usernames/history remain archived; no old passwords were migrated. Staff emails, centers and identities must still be reconciled and activated through verified Auth onboarding.

## Growth design follow-up

- Added a real daily next-step card derived from published module state, falling back to ungraded catalog exploration; no fabricated live completions.
- Added accessible tool-image enlargement using preserved source URLs. One source image was fetched successfully (200, image/webp); complete media availability still requires verification.
- Added mint, sky and warm palettes with light/dark variants; palettes persist independently of authentication.
- Expanded isolated bilingual previews with specialty covers, selectable specialty pathway examples, daily ungraded activity and six original catalog tool image references. All employee identities, goals, reports and result metrics in previews are fictional. Specialty illustrations are decorative, not clinical reference imagery.
- Verified Arabic/English RTL/LTR switching across nine preview pages, nurse/admin role switching, daily sample completion, specialty selection, image modal and palette changes using DOM execution. The 48 existing API/security/migration tests also pass. Browser/device visual acceptance and deployment remain pending Render second-account sign-in.

## Navigation clarity follow-up

- Added page Back and Learning path navigation, with role restrictions retained.
- Live lesson dialogs show the lesson number, previous/next lesson navigation and explicit Back to library. Opening the next lesson does not mark any lesson completed.
- Leaving an active official assessment through application navigation now asks for confirmation before the existing paused-review flow. Cancelling preserves the current page and navigation trail.
- Preview lessons now have four clearly numbered steps, Previous/Next controls, a final sample-completion action and Back to library. No official result is awarded.
- DOM interaction checks cover lesson step boundaries, Previous, library return and page history alongside bilingual/role/palette checks. Live browser acceptance remains pending deployment.

## 2026-11-05 17:01 (Asia/Riyadh) — Design deployed and browser checked

- Verified second Render workspace `Apexa5551's workspace`, existing dedicated `nse-staging` service and development branch before deploying.
- Deploy `dep-dbm8o359el5s73925to0`, source `53c3aa43603a679106601ea09ec330199d8b07a0`, reached **Deploy succeeded | Live** in 33.9 seconds. Node 22.23.4, build reported zero vulnerabilities.
- Browser reload restored the confirmed owner session and showed the redesigned operational UI, real empty published-module state and daily catalog exploration fallback.
- Browser checked live library/back navigation and real source tool image enlargement; the Rubber Dam image loaded successfully (`naturalWidth=1475`).
- Published `/preview` successfully rendered fictional nurse/admin views, Arabic/English switching and a four-step lesson. Next advanced Step 1 to Step 2; Back to library returned correctly. Light/dark appearance inspected on desktop.
- These checks do not complete staff onboarding, four-language clinical content review, real nurse/supervisor acceptance, mobile/iPad acceptance, practical/certificate workflows or load testing. Staging only; no merge to main.

## Development and verification implementation — pending deployment

- Added server-backed personal/team learning plans, own-notification read tracking, weekly lesson activity, reviewed skill rubric creation, practical observation controls, paused assessment review list, certificate revocation and authenticated card verification.
- Independent observer and meaningful evidence notes are required for practical observations; target specialty assignment is checked. Plans do not automatically create competency credentials.
- Added `/verify` page: demo references clearly identify fictional cards; actual persisted card UUIDs require authenticated owner/member access and are checked against server records. No staff identity is exposed publicly.
- Added clickable verification references to the competency/knowledge demo and real card display. Demo codes: `DEMO-NSE-C-0024`, `DEMO-NSE-K-0024`. These are example references, not actual issued staff credentials.
- 51 automated tests pass, including new cross-center plan/notification checks, independent observer requirements and card revocation. UI browser acceptance and deployment of these changes remain pending second Render account sign-in.
