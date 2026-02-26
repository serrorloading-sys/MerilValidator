-- ==========================================
-- AVATARS STORAGE SETUP SCRIPT
-- ==========================================
-- Run this script in your Supabase Dashboard > SQL Editor
-- It will create the 'avatars' bucket and set up the necessary security rules.

-- 1. Create a new public bucket named 'avatars'
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- 2. Allow Public Access to view avatars
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 3. Allow Authenticated Users to Upload their own avatars
create policy "Authenticated Users can Upload"
on storage.objects for insert
with check (
  bucket_id = 'avatars' 
  and auth.role() = 'authenticated'
);

-- 4. Allow Users to Update their own avatars
create policy "Users can update own files"
on storage.objects for update
using ( bucket_id = 'avatars' and auth.uid() = owner );

-- 5. Allow Users to Delete their own avatars
create policy "Users can delete own files"
on storage.objects for delete
using ( bucket_id = 'avatars' and auth.uid() = owner );
