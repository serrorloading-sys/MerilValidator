# Supabase Storage & Auto-Delete Setup

Run these SQL commands in your **Supabase Dashboard > SQL Editor** (Just like before).

## 1. Create Storage Bucket 'chat-attachments'
Create a new bucket and set it to public.

```sql
-- Create a new bucket
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true);

-- Allow public access (RLS Policies)

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
```

## 2. Auto-Delete Old Files (After 2 Days)
To automatically delete files older than 2 days, we use `pg_cron`. 

> **Note:** If `pg_cron` is not available on your plan, you can run this manually or use an external cron service (like GitHub Actions or a simple script).

```sql
-- Enable the extension (if possible)
create extension if not exists pg_cron;

-- Schedule a nightly job (Runs at 3 AM daily)
select cron.schedule(
  'delete-old-attachments', -- job name
  '0 3 * * *',              -- schedule (3 AM)
  $$
    delete from storage.objects
    where bucket_id = 'chat-attachments'
    and created_at < nowrap() - interval '2 days';
  $$
);
```

### Alternative (If pg_cron fails):
You can run this query manually once a week to clean up:
```sql
delete from storage.objects
where bucket_id = 'chat-attachments'
and created_at < nowrap() - interval '2 days';
```
