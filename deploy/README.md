# QIB v2 — Supabase + Render deployment contract
**Status:** integration code on development branch; NOT deployed. Existing Google Sheets/GAS production is unchanged.

## Safety
Create a new Supabase project dedicated to QIB. Do not execute schema.sql in another production project. Back up the legacy Sheets separately. Do not expose database passwords, service keys or user datasets to the browser/GitHub.

## Dedicated Supabase
1. Create private QIB Supabase project; configure Auth email/password and clinician-approved organizational onboarding.
2. Execute `deploy/schema.sql` in that dedicated project's SQL editor once reviewed. Schema is `qib`, not public; public/anon/authenticated grants are revoked. Tables have RLS enabled. Application database role on Render must be configured with least privilege (and network TLS); do not use postgres superuser credentials for long-term production.
3. Seed center memberships and staff assignments through a controlled admin-only onboarding flow. The system **does not** create admin roles from browser input.
4. Provision dedicated user accounts; never import legacy plaintext passwords.
5. Upload training media only to a private bucket with server-enforced center and role isolation, not public access.

## Render
Render Blueprint: `render.yaml`. Set env vars in Render dashboard, never commit them:
- DATABASE_URL: QIB project's dedicated Postgres connection string (with valid CA/TLS settings; see note below)
- SUPABASE_URL: QIB project Auth URL
- SUPABASE_PUBLISHABLE_KEY: public key used server-side for Auth verification request
- CORS_ORIGIN: exact deployed frontend origin
- PORT: Render provides this

The API uses `GET /health`, `GET /api/bootstrap?centerId=...`, `GET /api/learners?centerId=...`, `POST /api/assign`, `POST /api/exams/start`, `/event`, `/answer`, `/submit`, `/review`, `GET /api/achievements`, and `POST /api/observations`.
Authenticated endpoints require Supabase Auth **access JWT** in `Authorization: Bearer`. No admin/password login routes are exposed from the API.
Center IDs and staff identities are authorized by the server on EVERY operation. The official grade is computed from the server-side question snapshot. Tab exit causes session review, not a cheating accusation.

## Known gates before real staff rollout
- Get a dedicated database, Render workspace and domain; set up verified TLS certificate chain for pg and secret rotation.
- A browser-only app cannot guarantee visibility events were received. Implement heartbeat timeout and interrupted-session reconciliation before supervised exams.
- The browser preview at `v2/index.html` is NOT yet wired to this API. Its sessionStorage demo is deliberately separated from live data.
- Add cross-center isolation E2E, authorized onboarding, content revision publishing, private image upload, secure card signing/revocation, comprehensive translated lessons, staging and migration tests.
- Generate and commit an npm lockfile in a network-enabled build environment. `npm install --omit=dev` is bootstrap only; switch to `npm ci --omit=dev` after committing lockfile.
- Testing mockups does not certify clinical accuracy; all dermatology/IPC content must be reviewed by a credentialed clinical lead.
- Never merge this branch to main or set up automatic production deployment without explicit acceptance tests.
