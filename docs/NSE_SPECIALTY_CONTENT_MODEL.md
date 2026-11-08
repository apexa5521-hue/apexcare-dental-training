# Specialty curriculum and assessment model — requested 2026-11-08

All specialties share categories, while procedure, instrument and local-policy content remain specialty-specific. Learning supports Arabic, English, Urdu and Indonesian. Official assessments are English-only.

| Category | Learning material | Assessment candidates |
| --- | --- | --- |
| Procedure preparation | Procedure name, required tools and consumables, preparation checklist | Procedure → required item; missing item; appropriate tray |
| Instrument literacy | Verified photo, name, purpose, handling | Image → name; name → purpose; image → use; select instrument for a task |
| Patient journey | Reception, identification, communication, positioning, preparation | Scenario → best next action; communication choice; identify unsafe action |
| Infection prevention | Clinic preparation, hand hygiene moments, PPE, clean/dirty separation | Recognize hand hygiene indication; sequence; spot contamination |
| Clinical reasoning | Reviewed procedure scenarios, escalation criteria | Prioritization; safest next action; when to stop and escalate |
| Documentation and handover | Required documentation and structured handover | Missing information; accurate handover |
| Practical competence | Reviewed observable rubric and supervisor evidence | Direct observation; never awarded from a theory score alone |

## Content and media intake requirements (not implemented yet)

Manual image/video upload and PDF/Word intake must be center-scoped and authenticated, with file type/size validation, access-controlled storage and source/version provenance. Generated clinical media must be labeled and reviewed for anatomical/instrument accuracy. Image questions need answer-free filenames/alt text and cannot use visibly labeled images for identification.

AI extraction must create editable drafts only: source document ID/version, page or section, excerpt supporting answer, specialty, procedure/tool references, category, difficulty, learning objective, English stem/options/key/rationale, reviewed media reference, and reviewer status. No document instruction can authorize publication. Unsupported or conflicting claims require review, not invented answers. Do not upload staff or patient identifiers to generation services.

Publication requires clinical, language and local-policy review. Track source coverage, missing media, review and approved publication separately; generated quantity is not completion evidence.

## Exam behavior

Implemented locally: fresh attempt snapshots shuffle questions and options using cryptographic randomness, remap answer keys and retain the snapshot on resume; one-question UI, previous/next, session-only review flags, question navigation, answered indicators, whole-assessment countdown and confirmation showing unanswered/flagged counts. Flags are not yet persisted across reloads. Existing server deadline and server-side grading remain authoritative.

Pending: authorized multiple attempts with immutable historical results, attempt limits/waiting periods/supervisor approval; server-enforced per-question time mode; persistent flags; category-balanced sampling; image/video question delivery; source-file and AI intake workflow. Existing unique assessment/user constraint still prevents a new retake; never reset or overwrite historical attempts to bypass it.

Per-question timing needs an explicit policy: does leaving a question stop its timer, or does its deadline continue? Recommended cumulative server-tracked budget; expired questions become read-only and can still be flagged/revisited. Whole-assessment mode keeps unrestricted back/next until deadline. No automatic cheating accusation from navigation events.

Not deployed or browser accepted. Full specialty content is not ready for staff distribution.

## Implementation update

Persistent flags, single-use supervisor-approved retakes and server per-question deadlines are now implemented in `api/exam-workflows.js` and the operational UI. Per-question time is a fixed deadline from first opening and continues on navigation away; overall exam time remains a hard limit. Prior results are preserved in numbered attempts. The upgrade is staging-project restricted and repeat-safe. The earlier pending list above records the initial design, not the final status of these three features. Media/document intake and category-balanced sampling remain pending.
