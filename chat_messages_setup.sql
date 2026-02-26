-- =====================================================
-- CHAT MESSAGES & REACTIONS SETUP
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Messages Table
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  context_id text not null,
  sender_id uuid references profiles(id) on delete cascade,
  sender_name text,
  cipher text,
  message_type text default 'text', -- 'text' | 'image' | 'file'
  file_url text,
  file_name text,
  read_by uuid[] default '{}',
  created_at timestamptz default now()
);

-- Index for fast queries
create index if not exists idx_messages_context_id on messages(context_id, created_at desc);

-- 2. Emoji Reactions Table
create table if not exists message_reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

alter table messages enable row level security;
alter table message_reactions enable row level security;

-- Messages: authenticated users can read/write
create policy "Authenticated users can read messages"
  on messages for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert messages"
  on messages for insert
  with check (auth.uid() = sender_id);

create policy "Authenticated users can update their own messages"
  on messages for update
  using (auth.uid() = sender_id);

-- Allow users to update read_by field (for read receipts)
create policy "Authenticated users can mark messages as read"
  on messages for update
  using (auth.role() = 'authenticated');

-- Reactions: authenticated users can read/write
create policy "Authenticated users can read reactions"
  on message_reactions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert reactions"
  on message_reactions for insert
  with check (auth.uid() = user_id);

create policy "Authenticated users can delete their own reactions"
  on message_reactions for delete
  using (auth.uid() = user_id);

-- =====================================================
-- CHAT ATTACHMENTS BUCKET (run if not already created)
-- =====================================================

-- insert into storage.buckets (id, name, public)
-- values ('chat-attachments', 'chat-attachments', true)
-- on conflict (id) do nothing;

-- create policy "Public read for chat attachments"
--   on storage.objects for select using (bucket_id = 'chat-attachments');

-- create policy "Auth users can upload chat attachments"
--   on storage.objects for insert
--   with check (bucket_id = 'chat-attachments' and auth.role() = 'authenticated');
