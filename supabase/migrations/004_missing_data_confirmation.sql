alter table public.candidates
  add column if not exists missing_data_confirmed boolean not null default false;

create index if not exists candidates_missing_data_confirmed_idx
  on public.candidates(missing_data_confirmed)
  where missing_data_confirmed = false;
