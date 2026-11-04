-- Legacy catalog staging in a NEW NSE-only Supabase project.
-- Preserve all source IDs, arrays, translations and media references.
begin;
create table if not exists qib.legacy_catalog (
 source_name text not null check(source_name in ('Specialties','Tools','Procedures','IPC_Modules','IPC_Steps','Quizzes','AssessmentBank','AssessmentConfig')),
 legacy_id text not null,
 specialty_legacy_id text,
 payload jsonb not null,
 content_hash text not null,
 imported_at timestamptz not null default now(),
 primary key(source_name,legacy_id)
);
create index if not exists nse_legacy_catalog_by_specialty on qib.legacy_catalog(specialty_legacy_id,source_name);
create table if not exists qib.migration_runs (
 id uuid primary key default gen_random_uuid(),
 source_fingerprint text not null,
 source_counts jsonb not null,
 imported_counts jsonb not null,
 created_at timestamptz not null default now(),
 actor_label text not null default 'operator',
 notes text
);
alter table qib.legacy_catalog enable row level security;
alter table qib.migration_runs enable row level security;
revoke all on qib.legacy_catalog,qib.migration_runs from public,anon,authenticated;
commit;
