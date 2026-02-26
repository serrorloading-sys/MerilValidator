-- 1. Create a table for public profiles 
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  username text,
  avatar_url text,
  updated_at timestamp with time zone,
  last_seen timestamp with time zone
);

-- 2. Enable Row Level Security (RLS)
alter table profiles enable row level security;

-- 3. Create Policy: Public profiles are viewable by everyone.
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

-- 4. Create Policy: Users can insert their own profile.
create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

-- 5. Create Policy: Users can update own profile.
create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- 6. Trigger: Automatically create a profile on new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, username, last_seen)
  values (new.id, new.email, new.raw_user_meta_data->>'display_name', now());
  return new;
end;
$$ language plpgsql security definer;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
      create trigger on_auth_user_created
      after insert on auth.users
      for each row execute procedure public.handle_new_user();
  end if;
end
$$;
