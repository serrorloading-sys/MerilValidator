-- Enable pgcrypto for password hashing
create extension if not exists pgcrypto;

-- Create a secure function to update user passwords
-- This function is SECURITY DEFINER, meaning it runs with the privileges of the creator (postgres/admin)
-- This allows it to update the auth.users table even if the calling user (webapp) technically shouldn't.
create or replace function admin_reset_user_password(target_user_id uuid, new_password text)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the calling user is an admin (extra safety layer)
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Access Denied: Only admins can reset passwords.';
  end if;

  -- Update the user's encrypted password
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;
end;
$$;
