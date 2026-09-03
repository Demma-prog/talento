alter table public.candidates
  add column if not exists job_category text
    check (job_category in ('accounting','logistics','marketing','cashier','sales','warehouse','office','other')),
  add column if not exists protected_category boolean not null default false;

create index if not exists candidates_job_category_idx on public.candidates(job_category);
create index if not exists candidates_protected_category_idx on public.candidates(protected_category)
  where protected_category = true;

create table if not exists public.pending_cv_imports (
  id uuid primary key default gen_random_uuid(), requested_by uuid not null references auth.users(id),
  gmail_message_id text not null, attachment_id text not null, filename text not null,
  subject text, sender text, received_at timestamptz,
  status text not null default 'pending' check (status in ('pending','processing','failed')),
  attempts integer not null default 0, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (requested_by, gmail_message_id)
);
alter table public.pending_cv_imports enable row level security;
create policy "users manage own pending imports" on public.pending_cv_imports for all to authenticated
  using (requested_by = auth.uid()) with check (requested_by = auth.uid());
create trigger pending_cv_imports_set_updated_at before update on public.pending_cv_imports
  for each row execute function public.set_updated_at();
