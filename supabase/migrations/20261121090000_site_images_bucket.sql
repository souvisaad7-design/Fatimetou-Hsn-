-- صور الموقع: اللجنة ترفع صوراً من لوحة الإدارة (إعلانات، صفحات، صورة الواجهة). القراءة للجميع، والرفع والحذف للجنة فقط.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_images_read on storage.objects;
create policy site_images_read on storage.objects for select to anon, authenticated using (bucket_id = 'site');
drop policy if exists site_images_insert on storage.objects;
create policy site_images_insert on storage.objects for insert to authenticated with check (bucket_id = 'site' and public.is_admin());
drop policy if exists site_images_update on storage.objects;
create policy site_images_update on storage.objects for update to authenticated using (bucket_id = 'site' and public.is_admin()) with check (bucket_id = 'site' and public.is_admin());
drop policy if exists site_images_delete on storage.objects;
create policy site_images_delete on storage.objects for delete to authenticated using (bucket_id = 'site' and public.is_admin());
