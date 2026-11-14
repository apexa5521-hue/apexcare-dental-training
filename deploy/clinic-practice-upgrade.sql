begin;
create table if not exists qib.clinic_reviews(
 center_id uuid primary key references qib.centers(id),
 scenario_version integer not null,
 source_versions jsonb not null,
 reviewed_by uuid not null,
 review_note text not null,
 reviewed_at timestamptz not null default now()
);
create table if not exists qib.clinic_practice_sessions(
 id uuid primary key default gen_random_uuid(),
 center_id uuid not null references qib.centers(id),
 user_id uuid not null,
 procedure_id text not null,
 snapshot jsonb not null,
 step integer not null default 0 check(step between 0 and 5),
 status text not null default 'active' check(status in ('active','completed')),
 events jsonb not null default '[]',
 preview boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists clinic_practice_owner_idx on qib.clinic_practice_sessions(center_id,user_id,updated_at desc);
alter table qib.clinic_reviews enable row level security;
alter table qib.clinic_practice_sessions enable row level security;
revoke all on qib.clinic_reviews,qib.clinic_practice_sessions from public,anon,authenticated;
commit;
