-- 1. Ensure 'role' column exists in profiles
alter table public.profiles 
add column if not exists role text default 'user' check (role in ('user', 'admin'));

-- 2. Ensure 'global_config' table exists
create table if not exists public.global_config (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users
);

-- 3. Enable RLS on global_config
alter table public.global_config enable row level security;

-- 4. Create RLS Policies for global_config (Drop old ones first to avoid errors)
drop policy if exists "Public Read Access" on public.global_config;
create policy "Public Read Access"
on public.global_config for select
using ( true );

drop policy if exists "Admins Write Access" on public.global_config;
create policy "Admins Write Access"
on public.global_config for all
using ( 
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 5. MAKE EVERYONE ADMIN (For easy setup)
-- Run this, and ALL existing users will become admins.
update public.profiles 
set role = 'admin'
where role = 'user' or role is null;
