-- 1. Function to log config changes automatically
create or replace function log_global_config_changes()
returns trigger as $$
begin
  insert into public.audit_logs (actor_id, action, target_entity, target_id, metadata)
  values (
    auth.uid(),
    TG_OP, -- INSERT, UPDATE, DELETE
    'global_config',
    coalesce(new.key, old.key),
    jsonb_build_object(
      'old_value', old.value,
      'new_value', new.value
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2. Trigger for global_config
drop trigger if exists on_config_change on public.global_config;
create trigger on_config_change
  after insert or update or delete on public.global_config
  for each row execute function log_global_config_changes();

-- 3. Updated RPC: Password Reset with Logging
create or replace function admin_reset_user_password(target_user_id uuid, new_password text)
returns void
language plpgsql
security definer
as $$
begin
  -- Check if the calling user is an admin
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

  -- Log the action
  insert into public.audit_logs (actor_id, action, target_entity, target_id, metadata)
  values (
    auth.uid(),
    'RESET_PASSWORD',
    'user',
    target_user_id::text,
    '{}'::jsonb
  );
end;
$$;
