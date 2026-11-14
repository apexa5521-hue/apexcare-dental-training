begin;
-- Daily ungraded practice: one 3-question drill per learner per Riyadh day. Answer keys stay server-side.
create table if not exists qib.daily_drills(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 center_id uuid not null references qib.centers(id),
 day date not null,
 specialty_code text not null,
 questions jsonb not null,
 answers jsonb not null default '[]',
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(user_id,center_id,day)
);
alter table qib.daily_drills enable row level security;
revoke all on qib.daily_drills from public,anon,authenticated;
commit;
