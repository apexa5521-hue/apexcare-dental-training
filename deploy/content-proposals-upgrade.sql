begin;
-- AI-assisted lesson edit/translation proposals. Proposals never change a lesson until an
-- administrator accepts specific changes; accepted text returns the lesson to draft for review.
create table if not exists qib.module_proposals(
 id uuid primary key default gen_random_uuid(),
 center_id uuid not null references qib.centers(id),
 module_id uuid not null references qib.modules(id),
 base_version integer not null,
 mode text not null check(mode in ('revise','translate')),
 language text not null check(language in ('ar','en','ur','id')),
 source_language text check(source_language in ('ar','en','ur','id')),
 instruction text,
 base jsonb not null,
 proposed jsonb not null,
 origin text not null default 'ai',
 model text,
 created_by uuid not null,
 created_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','accepted','partially_accepted','rejected')),
 decided_by uuid,
 decided_at timestamptz,
 decision_note text,
 accepted_changes jsonb
);
create index if not exists module_proposals_module_idx on qib.module_proposals(module_id,created_at desc);
alter table qib.module_proposals enable row level security;
revoke all on qib.module_proposals from public,anon,authenticated;
commit;
