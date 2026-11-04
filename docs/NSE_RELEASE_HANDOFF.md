# NSE — Release handoff and migration status (2026-11-04)

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
