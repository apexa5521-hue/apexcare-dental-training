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

## 2026-11-07 — Verification/development staging deployment

- Dedicated second Render workspace and service reverified. Source `45901a6f4dc735d819f0cc9ed550fb60cedb1ac9` reached Live in deploy `dep-dbniiubm8hqs73can54g` (29.5s).
- Browser opened `/competency-demo`, clicked the competency card verification link and verified `/verify?id=DEMO-NSE-C-0024`. Knowledge demo reference also matched the correct card kind.
- Unknown reference was rejected; a synthetic non-demo UUID required sign-in and exposed no staff identity. No actual staff credential was created during these checks.
- These browser checks validate the demo verification experience and anonymous guard. Real authenticated staff card issuance, onboarding and all multi-role development workflows still require acceptance with verified test identities.

## 2026-11-08 — Content review, scheduling and real card display

- Added owner-only, repeat-safe conversion of imported IPC content into center-local draft lessons. Source catalog rows are never edited. Missing source translations remain blank and block publication.
- Publication now requires a review state, all four language titles/bodies and a documented clinical/translation approval recorded in content revisions. Administrators can edit imported translations and send drafts for review.
- Added assessment scheduling with device-local datetime controls, server validation, audit entries and a lock once any attempt exists.
- Added real card display with the signed-in name, actual evidence and verification link; no sample data is used for staff cards.
- Added onboarding readiness display that separates archived legacy users from enrolled nurses and identifies whether invitations are configured.
- Nurse learning endpoints now filter published lessons by assigned specialty (plus center-wide lessons).
- 55 automated tests passed, including module review gates, scheduling locks, repeat-safe IPC draft preparation and nurse specialty filtering. Deployment and browser acceptance of this follow-up remain pending.

## 2026-11-08 — Foundation learning content prepared

- Prepared `content/nse-foundations.json`: six authored lessons with Arabic, English, Urdu and Indonesian learning copy (24 localized versions), objectives and practical learning activities. Topics: hand hygiene, PPE, sharps, instrument reprocessing, patient identification and handover.
- Retained CDC/WHO source URLs for clinical reviewer reference. Clinical, language and local-policy review states remain pending; translations are draft translations, not clinically approved translations.
- Six English-only question drafts include options, answer keys and rationales in a server-side pack. They are not served as public web assets and are not embedded in published lesson bodies.
- Added owner-only preparation action to create center-local lesson/exam drafts without publishing. Repeated preparation does not duplicate or overwrite content. Both newly authored material and existing source IPC draft conversion remain distinct.
- Added a standalone reviewer preview to inspect all four languages and the English question drafts. It contains no staff data.
- 56 automated tests pass, including idempotent preparation and protection of question keys from nurse routes. This is a foundation batch, not complete specialty curricula or dermatology treatment protocols.

## 2026-11-08 — Specialty assessment expansion, first implementation

- Recorded the requested shared specialty content taxonomy and pending manual/AI media/document intake requirements in `docs/NSE_SPECIALTY_CONTENT_MODEL.md`.
- New attempt creation now shuffles question and option order using Node cryptographic randomness and remaps private answer indexes. Existing snapshots remain unchanged on resume; historical attempts are not overwritten.
- Added one-question navigation, Previous/Next, session-only flags, numbered question navigation, saved-answer indicators, whole-exam countdown and submission confirmation with unanswered/flagged counts.
- 57 automated tests passed, including real API server grading with shuffled options and a new permutation/answer integrity test. JavaScript syntax checks passed. Browser acceptance and deployment remain pending.
- Multiple authorized retakes, persistent flags, per-question server timing, document/AI extraction, secure manual media upload and balanced category sampling are not implemented by this change. Full content is not approved for staff distribution.

## 2026-11-08 — Persisted flags, authorized retakes and question timing

- Implemented authenticated center-scoped server workflows for persistent question flags, immutable per-question deadlines, timing configuration locked after first attempt, and independently approved retakes with a reason and availability/expiry window.
- Retakes create new numbered attempts, consume a single-use authorization and retain all previous attempts/results. Active/paused attempts resume instead of creating duplicates. Snapshots guarantee changed question/option order versus the previous attempt when alternatives exist, with server answer-key remapping.
- UI includes previous/next, numbered navigation, saved-answer markers, persisted flags, overall/question countdown and admin timing/retake controls. Per-question deadlines continue while navigating away; revisits cannot reset them. Official assessment text remains English-only.
- Added repeat-safe `deploy/exam-workflows-upgrade.sql` and startup runner restricted to the exact dedicated NSE staging Supabase URL. Existing Render-held credentials are not exported. The runner verifies original attempt counts/score totals and fails closed for any other project.
- 63 automated tests pass, including real API ownership/center checks, expired question rejection, snapshot stability on resume, retake grant consumption/history preservation and repeated schema upgrade. Syntax and whitespace checks pass.
- This release does not implement document AI extraction, secure manual media upload, category-balanced question selection or complete specialty content. Those remain separate work; no clinical approval or staff distribution is claimed.
- Deployment and browser acceptance of this revision are pending below.

## 2026-11-08 — Exam workflow release deployed

- Verified second Render workspace `Apexa5551's workspace`, service `srv-dbll3bh5efls73e348lg` and existing development branch. Deployed exact commit `59ed1354c0dfb2240a33a92b3786f09027cbf428`.
- Deploy `dep-dbo6saec6qcc73cqt6qg` reached **Deploy succeeded | Live** in 29.5s (15:42 Riyadh). Runtime log confirmed the NSE exam upgrade completed, historical attempt counts/score totals were unchanged and API became ready. Build audit reported zero vulnerabilities.
- Live site rendered its sign-in page successfully. The previous platform session expired; authenticated timing/retake/flag browser acceptance still needs the user to sign in. Local real-API/database tests passed; this does not substitute for nurse/supervisor browser acceptance.
- Supabase dashboard also requested sign-in, but database upgrade used only the existing Render-held dedicated NSE connection. No credentials were retrieved, no other project was contacted or changed, and no merge to main occurred.

## 2026-11-08 — Private media/document intake and operational study reader (not yet deployed)

- Added private center-scoped image/video/document uploads stored as PostgreSQL bytea in dedicated NSE. No files depend on Render's ephemeral filesystem. Supported PNG/JPEG/WebP (8 MiB), MP4 (20 MiB), PDF/DOCX (10 MiB) and TXT (1 MiB), with a 100 MiB per-center quota, MIME/signature checks and same-module hash deduplication. This consumes database capacity; object storage can replace this bounded adapter later.
- PDF and Word text extraction executes in isolated workers with memory/time/page/text bounds. Source bytes are retained, with page/paragraph references. Scanned PDFs have no OCR in this release; insufficient text blocks generation. Old binary `.doc` is not supported; `.docx` is supported. No silent text truncation.
- Content studio now supports manual English question drafts, categories/difficulty, source quotes, clinical rationales, private question images, edit-as-new-draft and independent clinical reviewer adoption into a specialty-matched draft exam. Adoption never publishes an exam. A verified separate administrator reviewer is required; no reviewer identity was fabricated.
- Added server-side OpenAI Responses integration with structured outputs, exact quote/section validation, explicit educational-only/send confirmation, draft-only results, bounded generation counts and no tools. Requires `OPENAI_API_KEY` and `OPENAI_MODEL` on Render; neither is configured in the local environment, and no real provider call was made. Unconfigured generation is explicitly disabled in UI; mock tests do not prove live generation.
- Replaced operational published-lesson dialog with short-step learning, Previous/Next, four-language controls, account-backed language/version bookmarks, and authenticated lesson media. Learning completion remains a self-reported study record, not clinical competency.
- Specialty catalog drafting now includes name-to-purpose and purpose-to-name questions with category metadata and round-robin coverage of available categories, plus procedure preparation questions. It does not invent missing patient scenarios or image material.
- Added repeat-safe private schema upgrade, startup integration, pinned PDF/Word parser and DOM-test dependencies and CI syntax checks. 75 automated tests passed, including actual PDF/DOCX extraction, real API private upload/evidence/reviewer checks, server bookmarks and DOM study navigation/completion. Runtime dependency audit: zero known vulnerabilities.
- Render cloud browser currently redirects to sign-in. Latest LIVE workload remains `59ed1354c0dfb2240a33a92b3786f09027cbf428`; this follow-up is pending deployment and authenticated desktop/mobile acceptance. Staff onboarding, independent clinical/language review, missing source translations/links, full specialty curricula, live AI generation and distribution remain incomplete. No main merge or staff distribution.

## 2026-11-08 — Evidence-based growth follow-up (pending deploy)

- Added private individual/team support-needs endpoints derived from latest submitted assessment results, wrong/unanswered category counts and latest practical observations. No evidence is not treated as competence. Question keys and individual answer choices are not exposed through growth endpoints.
- Supervisors can assign an evidence-linked suggested learning/practice/independent-review plan; repeat assignment returns the same active plan, preserving older results and preventing duplicate notifications.
- Added a Riyadh-date seven-day activity view, today's real lesson count and supportive messages without penalties or rankings. Weekly counts use Riyadh boundaries.
- Added deduplicated daily internal-inbox reminders for active plans with no lesson completion in three days. Sweep runs on startup and hourly while the web service is awake; free Render sleeping prevents exact-time guarantees. No email/push messages are sent.
- 77 automated tests pass, including evidence freshness, private growth endpoints, idempotent support plans and reminder deduplication. No competency issuance condition was relaxed.
- These changes are on the development branch only. Last Render interaction requested second-account authentication; deployment/authenticated UI and device acceptance remain blocked until that session is available. No main merge, staff activation, clinical approval or claim of complete release.

## 2026-11-08 18:07 Riyadh — Growth and content release LIVE

- User signed into the second Render and Supabase accounts. Verified workspace Apexa5551 and dedicated NSE-Staging project btehppfdtnajzmxtdhzk in Electronic System QIB (healthy).
- Deployed exact source `2d19e5196f3d00dc1a3b4b61c1cff5101c7e539f` on the existing service/development branch. Deploy `dep-dbo8vumc6qcc73cvslb0` reached **Deploy succeeded | Live** in 40.1 seconds. Runtime reported successful schema upgrade with historical attempt counts/score totals unchanged. Build audit: zero known vulnerabilities.
- This deploy includes private content/document intake, step-based learning and evidence-based growth follow-ups previously marked pending. No main merge or changes to other projects.
- Two attempts to open the application in the cloud browser failed with protocol navigation/frame-tree timeouts. This is a browser verification limitation, not evidence of a site bot block. Do not claim authenticated content/growth UI, mobile or nurse/supervisor acceptance from successful deploy alone.
- Live AI generation still requires configured server credentials/model and an actual generation acceptance run; clinical/language review, identity onboarding and full specialty coverage remain open.

## 2026-11-08 — Live content draft preparation and readiness follow-up

- Through the signed-in dedicated Supabase SQL editor, verified the existing center and previously authorized owner, then inserted the six foundation lessons (24 localized versions) and six English question drafts with repeat-safe SQL. UI returned `draft | 6` separately for lessons and questions. No publishing, credential issuance or source system writes occurred.
- Fixed a missing category/difficulty projection in new attempt snapshots so category-level support recommendations can use actual question metadata. Existing attempt snapshots are untouched.
- Added admin-only readiness counts (published/unpublished lessons, incomplete translations, pending questions, unresolved source links, enrolled roles and boolean service configuration). UI counts do not imply clinical approval or complete acceptance.
- 78 automated tests pass. Application cloud browser navigation remains impaired (existing blank tab and one fresh navigation timed out); Supabase SQL UI remains operational. Live AI configuration, verified staff onboarding, clinical/language approval, complete specialty content and authenticated/device acceptance are unresolved.

## 2026-11-08 18:16 Riyadh — Readiness release and live draft counts verified

- Commit `961f607f761f55ac1b4019933b84659461c55d4e` reached Live in deploy `dep-dbo947ou01pc73ej7lcg` (40.9 seconds). Verified intended second Render workspace/service, source SHA, successful schema/history guard and zero build audit vulnerabilities.
- Dedicated Supabase SQL UI independently returned: Foundation lessons (draft) 6; Foundation translations 24; Foundation questions (draft) 6. Screenshot retained without showing question keys. These are real database drafts, not complete specialty curricula or approved materials.
- Release remains staging. Full staff identity mappings, live AI credentials/model and clinical/language approval are unavailable; browser navigation failures still block authenticated role/device acceptance. No clinical credentials issued, old source modified or main merge performed.

## 2026-11-09 — 21st.dev-inspired interface refresh

- Inspected public Wensity Sidebar and Efferd Minimal Auth examples on 21st.dev. Authored original HTML/CSS adaptation rather than importing account-gated React components or adding a new framework.
- Added `v2/design-21.css` across operational sign-in, dashboard, library, catalog, assessments, passports, team, studio, reports and dialogs. Uses petroleum/teal palette, lighter borders, refined typography and fields, responsive navigation, RTL support and a dark variant. Existing role/auth/API controls unchanged.
- Added self-contained `v2/NSE-21st-Design-Preview.html` with existing nine-screen fictional nurse/admin interactions for immediate review; not real metrics, accounts or clinical credentials.
- Deployment and browser visual acceptance pending. Automated validation recorded below after completion.

## 2026-11-09 — Journey-first learning, exam focus and passport requirements

- Replaced library excerpt cards with a task-first journey: real completion percentage, prominent next unfinished lesson, numbered steps, completed/current/upcoming states and a visible card pathway. Upcoming lessons remain available rather than imposing unreviewed prerequisite locks.
- Added a private specialty-specific passport-path endpoint mirroring existing issuance checks: published specialty lessons, passed assessment, required practical skills/latest observations and actual active issued cards. Missing skills never count as practical competence. UI separates knowledge and competency stages and requires supervisor issuance.
- Official exam presentation now emphasizes one question, larger answer options, answered-percentage progress and distinct answered/flagged states. Progress is explicitly not a score; no correctness or answer keys are revealed during an attempt.
- Added self-contained fictional `NSE-Journey-Focus-Preview.html` for learning/exam/card route review. Its platform-navigation questions are unscored UI examples, not official bank questions. No credentials awarded.
- Automated validation: 79 tests pass. Deployment, visual acceptance and authenticated role/device acceptance of this follow-up remain pending; no clinical review or final readiness claimed.

## 2026-11-09 — Approved file-free content authoring

- Added admin-only creation of editable lesson scaffolds from a specialty-matched imported instrument/procedure or a manually entered topic, without uploading a file. Original source facts and unresolved procedure tool IDs are retained as provenance. Scaffolds explicitly require authoring and are blocked from publication until edited and reviewed; no inferred clinical instructions or missing translations are presented as approved content.
- Added manual draft archiving/restoration and safe published-module forking. Direct editing of a published lesson now fails closed and the studio creates a new draft, preserving the live version. Revision snapshots retain prior data.
- Added AI question-suggestion adapter for catalog/topic text using the existing structured-output/quote-validation integration. Requires configured provider credentials and explicit educational-only confirmation. It creates review candidates only; no real provider test was performed.
- This is not the complete AI lesson-edit comparison/accept/reject workflow. Image identification, full AI lesson generation and AI proposal comparison still need implementation and live acceptance. Existing manual question edit-as-new-draft remains available.
- 80 automated tests pass, including scaffold publication blocking, role/center boundaries, archival restoration and published version preservation. Not yet deployed or browser accepted.


## Verified staging release — 2026-11-09

- Deployed code: `8a65ffdbdbb7d89dfd113c0b628b7db9328c2aa2`. Render deployment `dep-dbosh3e417fc7399bk1g` succeeded and is Live (40.2 seconds).
- An earlier deployment of `55104c5` failed because the GitHub tree omitted baseline files, including the dependency lockfile. Restored the complete repository from the existing baseline plus all current modifications. All 78 committed files were compared byte-for-byte against the tested local files; no mismatches.
- Re-ran all 80 automated tests: 80 passed, 0 failed.
- Render build installed 59 packages and reported no production dependency vulnerabilities. Startup completed the staging-only database upgrade and confirmed historical attempt counts and total scores unchanged.
- Opened the deployed login page in the cloud browser and inspected its rendered design. This verifies the public sign-in page, not authenticated nurse/supervisor workflows or mobile acceptance.
- Full clinical content review, staff identity mapping, real AI configuration/generation, lesson AI proposal comparison, and authenticated end-to-end acceptance remain pending. No production merge or automatic content publication.

## 2026-11-09 — AI lesson edit/translation proposals with compare, accept and reject

- Added `api/content-proposals.js` and `deploy/content-proposals-upgrade.sql` (table `qib.module_proposals`, RLS on, no public grants; added to the staging-only startup upgrade).
- Admin-only, center-scoped: `POST /api/proposals/generate` (mode `revise` with an editor instruction, or `translate` from one of the four languages into another), `GET /api/proposals?moduleId=`, `POST /api/proposals/decide`.
- A proposal never changes the lesson. The studio shows a line-by-line comparison (title plus each changed block, Current vs Proposed, RTL aware); the administrator applies only the selected changes or rejects the proposal. Applying writes a `content_revisions` snapshot, bumps the version, returns the lesson to **draft** and records `_aiAssist[lang]` with clinical/language review pending. Publication rules are unchanged.
- Safety: requires educational-only confirmation; published lessons must be forked first; archived lessons refused; proposals built on an older version are refused as `PROPOSAL_STALE`; decided proposals cannot be reapplied. Prompt treats lesson text as untrusted, forbids inventing clinical facts and asks for `[NEEDS CLINICAL INPUT: …]` / `[TRANSLATION REVIEW: …]` markers. `store:false`.
- Tests: 84 pass (4 new: API workflow with a mock provider, center/role isolation, partial/stale/repeat decisions, diff/apply unit, output validation, DOM selection). Visual check at 390px and 1100px, light/dark, RTL, no horizontal scroll.
- Not done: no real provider call, because `OPENAI_API_KEY`/`OPENAI_MODEL` are not configured on Render. Generation stays disabled in the UI until they are set. Authenticated browser acceptance on staging is still pending.

## 2026-11-09 — Content-bound assistance without an AI subscription + dental chairside pack

Owner decision: no paid AI subscription is required. Added free, content-bound features; the optional OpenAI integration stays disabled unless keys are configured later.

- **Catalog question drafts (no AI)** — `api/content-rules.js`, `POST /api/content/rule-candidates` (admin, center-scoped). Builds English MCQ drafts only from documented catalog facts: purpose→name, name→purpose, procedure checklist (included / NOT included), IPC step order (first / next step). Each draft stores the exact catalog fact as `source_quote`, excludes rows with unresolved migration links, skips prompts already drafted, balances categories, and enters the existing independent review queue (`origin='catalog_rule_draft'`). Nothing is published; adoption still needs a different reviewer.
- **Ask the platform (search)** — `api/content-search.js`, `GET /api/search` for all roles, and `v2/content-search.js` card on the home page. Searches instruments/supplies (with image, purpose and procedures that use them), procedures (with listed items and count of unresolved links), IPC modules with ordered steps, and published lessons. Arabic/Urdu/Indonesian/English with Arabic spelling normalization. Nurses only see their assigned specialties and published lessons. Missing translations are labelled "Translation not available — shown in English".
- **Dental chairside pack** — `content/nse-dental.json`: 6 lessons × 4 languages (24 versions) linked to specialty `dental`: patient reception, operatory turnover, examination instruments, four-handed assisting, five moments at the chair, instrument flow to sterilization; plus 13 English question drafts with rationales. Sources: CDC dental infection-prevention summary pages and MMWR RR-5217, WHO hand-hygiene guideline. All `review: pending`. Owner action in the studio: "Prepare 6 multilingual dental chairside drafts" (`/api/modules/prepare-foundations` with `pack:'dental'`); repeat-safe, never publishes.
- Tests: 88 pass (rule generation/answer-key integrity, search normalization and role/specialty filtering, search UI translation labelling, dental pack preparation, idempotency and pack-name validation).
- Pending: deploy on the authorized Render workspace; owner runs the dental preparation on staging; clinical, language and center-policy review of the dental pack; authenticated device/role acceptance.


## 2026-11-10 — Guided interactive clinic

- Added center/user-scoped guided clinic sessions, a five-station room interface, patient communication decisions, published lesson references, a source-linked tray selection task, server-checked decisions, automatic progress saving and resume. This is guided learning; it never writes exam scores, practical observations, module completion or credentials.
- Existing general-dentistry (`gp`) and dental (`dental`) catalog IDs are preserved. Procedures with missing tool links are excluded. The initial release covers general chairside preparation/communication with a selected real procedure tray, not procedure-specific operative technique or a fabricated examination-procedure record. Other specialties and formal graded simulation remain future work.
- Nurses require assigned general-dentistry/dental access. All six dental source lessons must be published, and an admin must explicitly document scenario clinical/language/local-policy review before nurse use. Source version changes invalidate activation and older active sessions. Admin-only previews can use unpublished pack drafts, visibly labelled; no automatic publication or clinical approval.
- Private `qib.clinic_reviews` and `qib.clinic_practice_sessions` have RLS and revoked public/anon/authenticated grants. Repeat-safe startup SQL stays restricted to the authorized NSE staging project.
- Added four-language learning UI, source translation labels, dark/RTL/mobile CSS, Previous/Next station review and accessible click-based tray controls. No drag-only operation. Public `/clinic-preview` uses fictional tool names and placeholder lessons only; it never calls live APIs or saves an account record.
- Validation: 90 automated tests passed, including actual isolated database/API clinic workflow, role/center/specialty boundaries, review gate, step order, wrong/extra/missing tray items, resume, source changes, no credential issuance, and DOM navigation/localization. Deployment and authenticated acceptance recorded separately when verified.

- Commit `10130f95b24cd86f99f595586ad13f59609f14a3` saved the clinic implementation on the existing development branch. Render browser session redirected to login on 2026-11-10, so deployment was not triggered. Added a self-contained fictional `v2/NSE-Clinic-Preview-Standalone.html` using the same operational renderer for immediate offline review. Authenticated database/device/browser acceptance remains pending; the 90 automated tests do not prove live acceptance.

## 2026-11-10 — Procedure-tray practice

- `api/tray-practice.js` + `deploy/tray-practice-upgrade.sql` (`qib.tray_rounds`, RLS on, no public grants; in staging-only startup upgrade). `v2/tray-practice.js`: home-page card opening the practice dialog.
- `POST /api/tray/start`: picks a random documented procedure in the learner's assigned specialty (nurses cannot choose an unassigned one), skipping the last five, excluding catalog rows with unresolved migration links. Shows every listed item (resolved only, up to 13) mixed with unlisted distractors from the same specialty (max 16 tiles). The expected list is stored server-side only; documented uses are not sent before submission.
- `POST /api/tray/submit`: one submission per round, own rounds only. Returns correct / missed / wrong items with names and documented uses for feedback. Score = (correct − wrong) ÷ listed items, floored at 0. `GET /api/tray/history`: rounds, average, perfect trays.
- Item names are English (drills are English-only); feedback adds the learner's language name/use when the catalog has it. Labelled "Practice — not an official assessment"; it never counts as practical competency.
- Tests: 93 pass (round composition, grading, no answer leak, single submission, own-user/center isolation, unassigned specialty refusal). Visual check at 390px and 1280px.

## 2026-11-11 — Consistency pass, Today's Drill and Item of the Day

- `v2/consistency.css` (loaded last): one gap scale between blocks, one card padding/radius, one card heading size, compact equal-height stat boxes (two per row on phones), equal-height header controls, single-row week strip on phones, inline breadcrumb.
- `api/daily-practice.js` + `deploy/daily-practice-upgrade.sql` (`qib.daily_drills`, unique per learner/center/Riyadh day, RLS on, no public grants; in staging-only startup upgrade). `v2/daily-practice.js`: two home cards.
- **Today's Drill**: 3 English questions per learner per Riyadh day, one per category where possible (purpose→name, name→purpose, procedure checklist), built from catalog facts in assigned specialties (unresolved links excluded). Answer keys stay on the server; each answer is graded immediately, in order, once, with the correct option and documented rationale. Daily streak counts consecutive completed days. Practice only.
- **Item of the Day**: same instrument for the whole Riyadh day per specialty set, preferring items with a source image; shows English name, learner-language name/use when available (labelled when not), and up to four procedures that list it. Image opens enlarged.
- Tests: 96 pass (stable daily item, drill composition and key integrity, no key leak, order/once rules, other-user and other-center isolation, streak). Visual check at 390px and 1280px.

## 2026-11-11 — Tabbed admin pages and Studio fix

- `v2/page-tabs.js`: segmented tabs (pattern inspired by 21st.dev "Segmented Tabs", original vanilla code; no component code retrieved) for **Nursing team** (Team · Invite · Assign · History · Development) and **Content studio** (Overview · Lessons · Edit proposals · Questions · Exams · Media). Blocks are not moved; tabs only show the active tab's blocks and re-classify on DOM changes, so page scripts that re-render keep working. Active tab is remembered per page; arrow keys move between tabs; tabs scroll horizontally on phones. Forms in these pages use two columns on desktop (one on phones).
- Fixed a Studio bug introduced in `d3c0a9a`: `t.append(dentalPack)` threw `t is not defined`, which stopped the drafts list and preparation buttons from rendering. Now `root.append(dentalPack)`.
- 21st.dev connector verified on the user's free plan (2 code retrievals/day, unlimited search, no hosted AI generation).

## 2026-11-11 — Approved design round 2: emerald colour, notifications, daily row

- Design samples for approval: https://claude.ai/artifact/1axGfWeQS9MpappQzDgWS3 (private canvas; round 1 screens and round 2 colours/notifications/supervisor/lesson/card). Owner approved round 2.
- **Emerald palette** (`v2/consistency.css`, `v2/experience.js`): new default for everyone (a stored older choice is replaced once by `nse-palette-v2`); light buttons use `#0b7f59` for 5:1 contrast with white, the brighter `#0f9d6e` is used for decoration; night mode uses `#2fd39a` with dark button text (8.5:1). Hero and sign-in panel recoloured. Old palettes remain selectable.
- **Notifications** (`api/notifications.js`, `v2/notifications.js`): `GET /api/notifications` (own, current center, latest 50 + unread count) and `POST /api/notifications/read-all`; bell with unread badge in the header; panel with All / My tasks / Results / Content filters, Today/Yesterday/Earlier groups, click-to-read, mark-all-read, Esc/outside-click close, bottom sheet on phones; `window.nseToast()` for success/info/warning/error alerts. In-app only — no email/push.
- **Home**: Today's Drill, Procedure Tray and Item of the Day share one row on screens ≥1100px (`window.nseArrangeHome`).
- Fixed: filter clicks inside the notification panel closed it (detached-target outside-click check).
- Tests: 98 pass (own-only list/read-all across users and centers; bell count, filters, mark-all, toast role).

## 2026-11-12 — Stage B: navigation

- `v2/nav-layout.js`: side menu shows learner pages first, then an **Administration** group (team, studio, reports) for roles that have them. On phones (≤760px) the top menu strip is replaced by a fixed **bottom bar**: Home · Learn · Skills · Exams · More, with short labels in all four languages (full names kept as accessible labels). **More** opens a bottom sheet with the remaining pages, admin pages under their own heading; Esc, the scrim or Close dismiss it.
- The bar and sheet click the existing side-menu buttons, so role filtering, translations and the leave-an-active-assessment confirmation are unchanged; the current page is mirrored from the menu's `selected` state. Re-syncs when the menu is rebuilt (language change, center switch).
- Tests: 99 pass (admin group placement, bar order and labels, delegation to real buttons, current-page mirroring, sheet contents and close).

## 2026-11-12 — Stage C: exam screen

- `beginExam` in `v2/live.js` keeps all existing behaviour (server snapshots, answer saving, flags, per-question/whole-exam timers, heartbeat, pause on interruption, submit confirmation) and only changes structure: a header with title, answered-progress ("not your score") and a timer badge (`role="timer"`); two columns with the question and A–D lettered choices, and a side panel with the numbered question grid (answered / current / flagged, each with an accessible label), a colour key, submit and the English-only note.
- Choices are still native radios (visually hidden, keyboard focus ring on the card). Phones stack the panel under the question, stack the header, and hide the bottom navigation bar while an attempt is open so a stray tap cannot pause it.
- Styles in `v2/consistency.css`, light and dark. Tests: 99 pass.
