begin;
-- Ungraded procedure-tray practice. The expected item list stays server-side until submission.
create table if not exists qib.tray_rounds(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null,
 center_id uuid not null references qib.centers(id),
 specialty_code text not null,
 procedure_id text not null,
 options jsonb not null,
 expected jsonb not null,
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 selected jsonb,
 result jsonb
);
create index if not exists tray_rounds_user_idx on qib.tray_rounds(user_id,center_id,created_at desc);
alter table qib.tray_rounds enable row level security;
revoke all on qib.tray_rounds from public,anon,authenticated;
commit;
