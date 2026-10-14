create unique index profiles_expo_push_token_key on profiles (expo_push_token)
  where expo_push_token is not null;

create function public.claim_push_token(token text) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set expo_push_token = null
    where expo_push_token = token and id <> (select auth.uid());
  update public.profiles set expo_push_token = token
    where id = (select auth.uid());
end;
$$;

revoke all on function public.claim_push_token(text) from public, anon;
grant execute on function public.claim_push_token(text) to authenticated;
