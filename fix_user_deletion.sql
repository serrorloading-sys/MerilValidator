-- 1. Allow Admins to DELETE profiles
create policy "Admins can delete profiles"
on profiles for delete
using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- 2. Allow Admins to UPDATE profiles (e.g. changing roles)
create policy "Admins can update profiles"
on profiles for update
using (
  exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  )
);

-- 3. Fix Foreign Key on profiles to allow cascading delete from Auth
-- This makes it so if you delete the user in Supabase Auth, the profile goes with it.
-- We first drop the existing constraint and re-add it with ON DELETE CASCADE.
alter table profiles
drop constraint if exists profiles_id_fkey,
add constraint profiles_id_fkey
foreign key (id)
references auth.users (id)
on delete cascade;

-- 4. Fix Foreign Key on global_config (updated_by) just in case
-- If a user who updated a config is deleted, set the field to NULL instead of blocking deletion.
alter table global_config
drop constraint if exists global_config_updated_by_fkey,
add constraint global_config_updated_by_fkey
foreign key (updated_by)
references auth.users (id)
on delete set null;
