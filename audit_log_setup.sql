-- 0. Drop existing table to fix schema if it exists with wrong FK
drop table if exists audit_logs cascade;

-- 1. Create Audit Logs Table
create table audit_logs (
  id uuid default gen_random_uuid() primary key,
  actor_id uuid references public.profiles(id), -- Changed from auth.users to public.profiles
  action text not null, -- 'UPDATE', 'DELETE', 'CREATE', etc.
  target_entity text not null, -- 'global_config', 'user', 'profile'
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 2. Enable RLS
alter table audit_logs enable row level security;

-- 3. Policies
-- Admins can VIEW all logs
create policy "Admins can view audit logs"
  on audit_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can INSERT logs (for client-side actions like User Creation)
create policy "Admins can insert audit logs"
  on audit_logs for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
