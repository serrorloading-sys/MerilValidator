-- 1. Create Storage Bucket 'chat-attachments'
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true);

-- 2. Allow public access (RLS Policies)

-- Policy: Everyone can View files
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'chat-attachments' );

-- Policy: Authenticated Users can Upload
create policy "Authenticated Users can Upload"
on storage.objects for insert
with check (
  bucket_id = 'chat-attachments' 
  and auth.role() = 'authenticated'
);

-- Policy: Users can Delete their own files (Optional)
create policy "Users can update own files"
on storage.objects for update
using ( auth.uid() = owner );

create policy "Users can delete own files"
on storage.objects for delete
using ( auth.uid() = owner );

-- 3. Auto-Delete Old Files (After 2 Days)
-- Note: 'pg_cron' extension must be enabled for this to work.
-- If not available, you can run this delete query manually periodically.

-- Enable extension
create extension if not exists pg_cron;

-- Schedule job
select cron.schedule(
  'delete-old-attachments',
  '0 3 * * *',
  $$
    delete from storage.objects
    where bucket_id = 'chat-attachments'
    and created_at < nowrap() - interval '2 days';
  $$
);
