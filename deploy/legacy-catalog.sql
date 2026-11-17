-- Legacy catalog staging in a NEW NSE-only Supabase project.
-- Preserve all source IDs, arrays, translations and media references.
begin;
create table if not exists qib.legacy_catalog (
 source_name text not null check(source_name in ('Specialties','Tools','Procedures','IPC_Modules','IPC_Steps','Quizzes','AssessmentBank','AssessmentConfig','Doctors','DoctorPrefs')),
 legacy_id text not null,
 specialty_legacy_id text,
 payload jsonb not null,
 content_hash text not null,
 imported_at timestamptz not null default now(),
 primary key(source_name,legacy_id)
);
create index if not exists nse_legacy_catalog_by_specialty on qib.legacy_catalog(specialty_legacy_id,source_name);
create table if not exists qib.migration_issues(
 source_name text not null,legacy_id text not null,field text not null,missing_id text not null,
 resolved_at timestamptz,primary key(source_name,legacy_id,field,missing_id)
);
alter table qib.migration_issues enable row level security;
revoke all on qib.migration_issues from public,anon,authenticated;
create table if not exists qib.migration_runs (
 id uuid primary key default gen_random_uuid(),
 source_fingerprint text not null,
 source_counts jsonb not null,
 imported_counts jsonb not null,
 created_at timestamptz not null default now(),
 actor_label text not null default 'operator',
 notes text
);
-- Restricted archive preserves historical training data without importing legacy passwords.
create table if not exists qib.legacy_history_archive (
 source_name text not null check(source_name in ('Users','AssessmentResults','NurseProgress','DrillProgress','Logs','Mastery')),
 legacy_key text not null,
 payload jsonb not null,
 content_hash text not null,
 imported_at timestamptz not null default now(),
 primary key(source_name,legacy_key)
);
alter table qib.legacy_history_archive enable row level security;
revoke all on qib.legacy_history_archive from public,anon,authenticated;
create table if not exists qib.legacy_identity_map(
 center_id uuid not null references qib.centers(id),
 legacy_username text not null,
 user_id uuid not null,
 mapped_by uuid not null,
 mapped_at timestamptz not null default now(),
 primary key(center_id,legacy_username),
 unique(center_id,user_id)
);
create unique index if not exists nse_legacy_identity_single_center on qib.legacy_identity_map(legacy_username);
alter table qib.legacy_identity_map enable row level security;
revoke all on qib.legacy_identity_map from public,anon,authenticated;
create index if not exists nse_archive_results_username on qib.legacy_history_archive((payload->>'username')) where source_name in ('AssessmentResults','NurseProgress','DrillProgress');
create table if not exists qib.assessment_reviews (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references qib.assessments(id),
 reviewer_id uuid not null,
 note text not null,
 reviewed_at timestamptz not null default now()
);
alter table qib.assessment_reviews enable row level security;
revoke all on qib.assessment_reviews from public,anon,authenticated;
alter table qib.legacy_catalog enable row level security;
alter table qib.migration_runs enable row level security;
revoke all on qib.legacy_catalog,qib.migration_runs from public,anon,authenticated;
commit;
