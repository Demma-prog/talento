create extension if not exists pgcrypto;

create type public.application_status as enum (
  'never_contacted', 'to_contact', 'contacted', 'interview_scheduled',
  'accepted', 'rejected_after_contact', 'rejected_directly',
  'unavailable', 'reconsider'
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  birth_year smallint,
  birth_place text,
  declared_gender text,
  email text,
  normalized_email text,
  phone text,
  normalized_phone text,
  city text,
  bio text,
  bio_source text check (bio_source in ('cv', 'ai_summary', 'manual')),
  status public.application_status not null default 'never_contacted',
  latest_gmail_message_id text unique,
  latest_attachment_id text,
  latest_cv_hash text,
  latest_cv_filename text,
  latest_cv_received_at timestamptz,
  expires_at timestamptz,
  extraction_confidence numeric(4,3),
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index candidates_email_unique on public.candidates(normalized_email)
  where normalized_email is not null;
create index candidates_phone_idx on public.candidates(normalized_phone)
  where normalized_phone is not null;
create index candidates_expiry_idx on public.candidates(expires_at);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  company text, role text not null, location text,
  start_date date, end_date date, is_current boolean not null default false,
  description text, sort_order integer not null default 0
);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  institution text, qualification text not null, field_of_study text,
  start_year smallint, end_year smallint, sort_order integer not null default 0
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  name text not null, category text, level text
);

create table public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null check (char_length(body) <= 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_events (
  id bigint generated always as identity primary key,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null,
  from_value text, to_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid references auth.users(id),
  status text not null default 'pending',
  gmail_cursor text,
  found_count integer not null default 0,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.candidates enable row level security;
alter table public.experiences enable row level security;
alter table public.education enable row level security;
alter table public.skills enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.candidate_events enable row level security;
alter table public.import_runs enable row level security;

create policy "authenticated users manage candidates" on public.candidates for all to authenticated using (true) with check (true);
create policy "authenticated users manage experiences" on public.experiences for all to authenticated using (true) with check (true);
create policy "authenticated users manage education" on public.education for all to authenticated using (true) with check (true);
create policy "authenticated users manage skills" on public.skills for all to authenticated using (true) with check (true);
create policy "authenticated users manage notes" on public.candidate_notes for all to authenticated using (true) with check (true);
create policy "authenticated users read events" on public.candidate_events for select to authenticated using (true);
create policy "authenticated users read imports" on public.import_runs for select to authenticated using (true);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger candidates_set_updated_at before update on public.candidates for each row execute function public.set_updated_at();
create trigger notes_set_updated_at before update on public.candidate_notes for each row execute function public.set_updated_at();
