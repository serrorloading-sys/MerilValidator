-- 1. Add 'role' column to profiles
--    Default is 'user'. We use text check constraint for simple enum-like behavior.
alter table public.profiles 
add column if not exists role text default 'user' check (role in ('user', 'admin'));

-- 2. Create 'global_config' table
create table if not exists public.global_config (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default now(),
    updated_by uuid references auth.users
);

-- 3. Enable RLS on global_config
alter table public.global_config enable row level security;

-- 4. RLS Policies for global_config

-- Policy: Everyone can READ config (Public)
create policy "Public Read Access"
on public.global_config for select
using ( true );

-- Policy: Only Admins can INSERT/UPDATE/DELETE
create policy "Admins Write Access"
on public.global_config for all
using ( 
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'admin'
  )
);

-- 5. FUNCTION TO ASSIGN ADMIN (Run this manually for your user)

-- ⚠️ REPLACE 'YOUR_USER_ID_HERE' WITH THE ACTUAL UUID OF USER 61608
-- You can find the UUID in the Authentication > Users section of Supabase.
-- Example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

/* 
update public.profiles 
set role = 'admin' 
where id = 'YOUR_USER_ID_HERE';
*/

-- Alternatively, if you know the email:
/*
update public.profiles
set role = 'admin'
where email = 'user_email@example.com';
*/
