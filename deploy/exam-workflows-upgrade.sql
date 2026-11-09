-- Apply only to dedicated NSE staging before deploying exam-workflows.js.
-- Additive upgrade preserves original attempts and result evidence.
begin;
alter table qib.assessments add column if not exists timing_mode text not null default 'total' check(timing_mode in ('total','per_question'));
alter table qib.assessments add column if not exists seconds_per_question integer not null default 60 check(seconds_per_question between 10 and 3600);
alter table qib.attempts add column if not exists attempt_number integer not null default 1 check(attempt_number>0);
alter table qib.attempts add column if not exists flags jsonb not null default '{}';
alter table qib.attempts add column if not exists question_clocks jsonb not null default '{}';
alter table qib.attempts add column if not exists timing_mode text not null default 'total';
alter table qib.attempts add column if not exists seconds_per_question integer not null default 60;
alter table qib.attempts drop constraint if exists attempts_assessment_id_user_id_key;
create unique index if not exists attempts_assessment_user_number on qib.attempts(assessment_id,user_id,attempt_number);
create unique index if not exists attempts_one_open on qib.attempts(assessment_id,user_id) where status in ('active','paused_review');
create table if not exists qib.retake_grants(id uuid primary key default gen_random_uuid(),assessment_id uuid not null references qib.assessments(id),center_id uuid not null references qib.centers(id),user_id uuid not null,previous_attempt_id uuid not null unique references qib.attempts(id),approved_by uuid not null,reason text not null,available_at timestamptz not null default now(),expires_at timestamptz not null,used_by_attempt_id uuid references qib.attempts(id),created_at timestamptz not null default now());
alter table qib.retake_grants enable row level security;
revoke all on qib.retake_grants from public,anon,authenticated;
commit;
