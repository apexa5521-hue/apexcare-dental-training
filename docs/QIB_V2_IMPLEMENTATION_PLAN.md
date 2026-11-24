# QIB System v2 — Implementation plan
Status: IN PROGRESS (design and security foundation only). Production must remain unchanged.
Branch: `feature/qib-platform-v2-security-ux`. Branch protection convention: no merge/deploy without passing gates and explicit approval.
## Non-negotiable migration rules
- Never delete, regenerate or overwrite curated Procedures.toolIds and Procedures.consumableIds.
- All new Sheets columns added append-only with a verified migration and backup; never reclassify historical tool data.
- Preserve English-only exam/drill/tray questions. Arabic/multilingual navigation is permitted.
- Keep existing Pages and Apps Script deployment live; change GAS_URL only on a tested staging deployment, in BOTH pages.
- No plaintext credentials, spreadsheet IDs, API deployment URLs or real nurse records in this public GitHub repository.
- Keep the existing index.html/apex-clinical-ref.html untouched during initial audit.
- All UI copy and published assets use QIB System brand; footer: Built and developed by Ibrahim Alluhaydi.
## Priority P0 — safety, identity and integrity (gate before any official exam)
1. Remove frontend ADMIN_PW bypass; implement authenticated, role-checked server sessions with expiry/revocation, rotate exposed passwords.
2. Require authenticated user identity for every assessment call; derive username from server session, not a submitted username.
3. Split public learning catalog from protected question/answer bank. Never send answer keys for official exams.
4. Server generates and persists question order, options, immutable exam version and authoritative answer key.
5. Start one attempt per (assessment,user), assign non-guessable opaque attempt ID; store server timestamps and fixed deadline. Distinct statuses: active, paused_review, submitted, void.
6. Autosave each answer server-side. Submission recalculates score from server-stored answer key, not client-correct counts.
7. On visibility hidden/pagehide/blur signal send event to server, atomically mark paused_review. Client immediately locks exam even if network call fails. Reload must query server attempt state and not create a second attempt.
8. Heartbeat leases and reentry reconciliation: because browser exit events are unreliable, failure to renew lease beyond grace pauses for review on next interaction; classify device/system interruption neutrally.
9. Only supervisor/admin with independent credential may resume or void with mandatory reason; full immutable audit trail. Resume cannot extend original deadline without separately logged admin accommodation.
10. Idempotency keys for event and submission; locking/transaction and optimistic version guards for concurrent requests.
11. Enforce role-based permissions across all mutation endpoints, including uploads and AI generation; rate limiting/size/MIME checks.
## P1 — redesign and training core
- Responsive nurse learning home: required tasks, continue learning, progress per specialty, accessible English drills.
- Supervisor competency dashboard: evidence, observed skill checklists, statuses and review queue.
- Admin: catalog with typed image metadata, alt text, moderation, draft/published revisions and rollback.
- Virtual Clinic: preserve procedure classification, build clinical scenario and instrument/consumable training modes.
- Quality content workflow: clinical author -> IPC reviewer -> publisher; effective date and source revision.
## P2 — competency and remediation
- Skills Passport per nurse: skill_id, required observation, observer, rubric, result, date, audit.
- Individual onboarding/remediation plan: baseline -> assigned modules -> practice -> observed skills -> final assessment -> approval.
- Adaptive practice: rule-based missed-skill targeting, spaced review; never reuse official exam answer disclosures.
- Reports: cohorts, baseline vs final, overdue, question discrimination, item exposure and fairness checks.
## P3 — lifecycle and communications
- Evidence-linked certificates with unique verification token and revocation; cannot imply licensing/accreditation.
- Notifications for new training, scheduled exams, overdue skill assessments; digest and quiet hours.
- Integration and adoption feedback from nurse/supervisor/admin pilot.
## Schema proposals (additive; separate from live Sheets pending migration rehearsal)
ExamAttempts: id,assessmentId,userId,assessmentVersion,status,questionSnapshotRef,startedAt,deadlineAt,lastHeartbeatAt,pausedAt,finalizedAt,score,version
ExamAnswers: attemptId,questionId,choiceIndex,changedAt
ExamEvents: eventId,attemptId,userId,type,serverAt,deviceSessionId,metadata
ExamReviews: reviewId,attemptId,reviewerId,decision,reason,serverAt
CompetencySkills; SkillObservations; LearningPlans; ContentRevisions; MediaAssets; Notifications; Certificates
**Note:** Google Sheets alone lacks robust database transactions. Apps Script LockService with strict idempotency can reduce races for a pilot; production-grade high-stakes assessments should use a transactional database before launch.
## Test gates
Security: spoofed username; fake score; forged role/token; exposed answer keys; unauthorized CRUD; anonymous image upload; double start; double submit; stale read; same-attempt concurrent writes; replay/expired session; race between submit and pause.
Anti-cheat: leave tab; pagehide; refresh; offline; browser crash; heartbeat timeout; multi-tab/device; fullscreen escape; assistive technology; false positive appeals; supervisor review audit.
Functional: 12+ question styles, consumable no-name prompts, one-attempt policy, scheduled windows, English exam language, output/CSV and per-nurse report.
Content: curated Procedures mappings unchanged; media missing/broken URLs; revision rollback; multilingual UI; video persistence; no production credentials.
Accessibility: iPad/mobile/desktop, keyboard/screen reader, focus, low-bandwidth, clear loading/errors.
Release gate: unit + integration + UI E2E + backup/restore rehearsal + security review + anonymized supervisor pilot, then explicit production approval.
## Delivery sequence
A. Security interfaces/state-machine and test harness on feature branch.
B. Staging back-end implementation; review permission boundaries, build migrations + dataset fixtures.
C. UI design system and role-based pages; run clinician-centered usability tests.
D. Feature modules and reporting; QA and documentation.
E. Pull request and staged release. Never automatically merge.
