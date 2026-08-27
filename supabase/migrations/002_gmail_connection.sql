create table public.gmail_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_address text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gmail_connections enable row level security;
create trigger gmail_connections_set_updated_at before update on public.gmail_connections
for each row execute function public.set_updated_at();
