alter table profiles enable row level security;
alter table items enable row level security;
alter table outfits enable row level security;

revoke all on public.profiles, public.items, public.outfits from anon, authenticated;
grant select, insert, update, delete on public.items, public.outfits to authenticated;
grant select, update on public.profiles to authenticated;

create policy profiles_select_own on profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy items_select_own on items for select to authenticated
  using (user_id = (select auth.uid()));
create policy items_insert_own on items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy items_update_own on items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy items_delete_own on items for delete to authenticated
  using (user_id = (select auth.uid()));

create policy outfits_select_own on outfits for select to authenticated
  using (user_id = (select auth.uid()));
create policy outfits_insert_own on outfits for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy outfits_update_own on outfits for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy outfits_delete_own on outfits for delete to authenticated
  using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public) values ('items', 'items', false)
  on conflict do nothing;

create policy items_objects_select_own on storage.objects for select to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy items_objects_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy items_objects_update_own on storage.objects for update to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy items_objects_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
