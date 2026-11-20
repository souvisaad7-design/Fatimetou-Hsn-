-- =====================================================================
-- «إدارة الموقع»: اللجنة تتحكم في محتوى الموقع من لوحة الإدارة دون برمجة
--  - site_settings : معلومات الموقع العامة (الأسماء، العبارة، الأرقام، طرق الدفع، الروابط)
--  - site_posts    : إعلانات وأخبار تظهر للمنتسبين
--  - site_pages    : صفحات جديدة تضيفها اللجنة (من نحن، النظام الداخلي، المشاريع...)
--  - assistant_faq : أسئلة وأجوبة إضافية للمساعد الذكي
--  - أعضاء اللجنة : إضافة عضو برقم هاتفه أو إزالته
-- القراءة للجميع (المنشور فقط)، والكتابة للجنة فقط عبر دوال آمنة. لا تغيير على الجداول الموجودة.
-- =====================================================================

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 30000),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.site_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  body text not null default '' check (char_length(body) <= 4000),
  image_url text check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 600)),
  link_url text check (link_url is null or (link_url ~ '^https://' and char_length(link_url) <= 600)),
  pinned boolean not null default false,
  published boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_posts_idx on public.site_posts (published, pinned desc, created_at desc);

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  title_ar text not null check (char_length(title_ar) between 2 and 80),
  title_fr text not null default '' check (char_length(title_fr) <= 80),
  body_ar text not null default '' check (char_length(body_ar) <= 20000),
  body_fr text not null default '' check (char_length(body_fr) <= 20000),
  sort integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistant_faq (
  id uuid primary key default gen_random_uuid(),
  keywords text[] not null check (cardinality(keywords) between 1 and 30),
  answer_has text not null check (char_length(answer_has) between 2 and 2000),
  answer_ar text not null default '' check (char_length(answer_ar) <= 2000),
  answer_fr text not null default '' check (char_length(answer_fr) <= 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
alter table public.site_posts enable row level security;
alter table public.site_pages enable row level security;
alter table public.assistant_faq enable row level security;
revoke all on public.site_settings, public.site_posts, public.site_pages, public.assistant_faq from anon, authenticated;
grant select on public.site_settings, public.site_posts, public.site_pages, public.assistant_faq to anon, authenticated;
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
drop policy if exists site_posts_read on public.site_posts;
create policy site_posts_read on public.site_posts for select to anon, authenticated using (published or public.is_admin());
drop policy if exists site_pages_read on public.site_pages;
create policy site_pages_read on public.site_pages for select to anon, authenticated using (published or public.is_admin());
drop policy if exists assistant_faq_read on public.assistant_faq;
create policy assistant_faq_read on public.assistant_faq for select to anon, authenticated using (active or public.is_admin());

-- ============== دوال اللجنة ==============
create or replace function public.save_site_settings(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'بيانات غير صحيحة'; end if;
  if pg_column_size(p) >= 30000 then raise exception 'المحتوى طويل جداً'; end if;
  if coalesce(p->>'phone', '') !~ '^([234][0-9]{7})?$' then raise exception 'رقم الهاتف 8 أرقام يبدأ بـ 2 أو 3 أو 4'; end if;
  update public.site_settings set data = p, updated_at = now(), updated_by = auth.uid() where id;
end $$;
revoke execute on function public.save_site_settings(jsonb) from public, anon;
grant execute on function public.save_site_settings(jsonb) to authenticated;

create or replace function public.save_site_post(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if v_id is null then
    insert into public.site_posts (title, body, image_url, link_url, pinned, published)
    values (trim(p->>'title'), coalesce(trim(p->>'body'), ''), nullif(trim(p->>'image_url'), ''), nullif(trim(p->>'link_url'), ''),
            coalesce((p->>'pinned')::boolean, false), coalesce((p->>'published')::boolean, true))
    returning id into v_id;
  else
    update public.site_posts set title = trim(p->>'title'), body = coalesce(trim(p->>'body'), ''),
      image_url = nullif(trim(p->>'image_url'), ''), link_url = nullif(trim(p->>'link_url'), ''),
      pinned = coalesce((p->>'pinned')::boolean, false), published = coalesce((p->>'published')::boolean, true), updated_at = now()
    where id = v_id;
    if not found then raise exception 'الإعلان غير موجود'; end if;
  end if;
  return v_id;
exception when check_violation or not_null_violation or invalid_text_representation then
  raise exception 'بيانات الإعلان غير صحيحة: العنوان من 2 إلى 160 حرفاً، والروابط تبدأ بـ https://';
end $$;
revoke execute on function public.save_site_post(jsonb) from public, anon;
grant execute on function public.save_site_post(jsonb) to authenticated;

create or replace function public.delete_site_post(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.site_posts where id = p_id;
end $$;
revoke execute on function public.delete_site_post(uuid) from public, anon;
grant execute on function public.delete_site_post(uuid) to authenticated;

create or replace function public.save_site_page(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if v_id is null then
    insert into public.site_pages (slug, title_ar, title_fr, body_ar, body_fr, sort, published)
    values (lower(trim(p->>'slug')), trim(p->>'title_ar'), coalesce(trim(p->>'title_fr'), ''), coalesce(p->>'body_ar', ''), coalesce(p->>'body_fr', ''),
            coalesce((p->>'sort')::int, 0), coalesce((p->>'published')::boolean, true))
    returning id into v_id;
  else
    update public.site_pages set slug = lower(trim(p->>'slug')), title_ar = trim(p->>'title_ar'), title_fr = coalesce(trim(p->>'title_fr'), ''),
      body_ar = coalesce(p->>'body_ar', ''), body_fr = coalesce(p->>'body_fr', ''), sort = coalesce((p->>'sort')::int, 0),
      published = coalesce((p->>'published')::boolean, true), updated_at = now()
    where id = v_id;
    if not found then raise exception 'الصفحة غير موجودة'; end if;
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'يوجد صفحة أخرى بنفس الرابط المختصر';
  when check_violation or not_null_violation or invalid_text_representation then
    raise exception 'بيانات الصفحة غير صحيحة: العنوان من 2 إلى 80 حرفاً، والرابط المختصر بحروف إنجليزية صغيرة وأرقام و - فقط';
end $$;
revoke execute on function public.save_site_page(jsonb) from public, anon;
grant execute on function public.save_site_page(jsonb) to authenticated;

create or replace function public.delete_site_page(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.site_pages where id = p_id;
end $$;
revoke execute on function public.delete_site_page(uuid) from public, anon;
grant execute on function public.delete_site_page(uuid) to authenticated;

create or replace function public.save_assistant_faq(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid; v_kw text[];
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  select coalesce(array_agg(distinct k), '{}') into v_kw
    from (select trim(x) k from jsonb_array_elements_text(coalesce(p->'keywords', '[]'::jsonb)) x) s where char_length(k) between 2 and 60;
  if cardinality(v_kw) = 0 then raise exception 'أضف كلمة مفتاحية واحدة على الأقل'; end if;
  if v_id is null then
    insert into public.assistant_faq (keywords, answer_has, answer_ar, answer_fr, active)
    values (v_kw, trim(p->>'answer_has'), coalesce(trim(p->>'answer_ar'), ''), coalesce(trim(p->>'answer_fr'), ''), coalesce((p->>'active')::boolean, true))
    returning id into v_id;
  else
    update public.assistant_faq set keywords = v_kw, answer_has = trim(p->>'answer_has'), answer_ar = coalesce(trim(p->>'answer_ar'), ''),
      answer_fr = coalesce(trim(p->>'answer_fr'), ''), active = coalesce((p->>'active')::boolean, true), updated_at = now()
    where id = v_id;
    if not found then raise exception 'السؤال غير موجود'; end if;
  end if;
  return v_id;
exception when check_violation or not_null_violation then
  raise exception 'بيانات السؤال غير صحيحة: الجواب من 2 إلى 2000 حرف';
end $$;
revoke execute on function public.save_assistant_faq(jsonb) from public, anon;
grant execute on function public.save_assistant_faq(jsonb) to authenticated;

create or replace function public.delete_assistant_faq(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.assistant_faq where id = p_id;
end $$;
revoke execute on function public.delete_assistant_faq(uuid) from public, anon;
grant execute on function public.delete_assistant_faq(uuid) to authenticated;

-- ============== أعضاء اللجنة ==============
create or replace function public.list_committee() returns table (user_id uuid, full_name text, phone text, created_at timestamptz, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  return query
    select a.user_id, coalesce(m.full_name, '—'), split_part(u.email, '@', 1), a.created_at, a.user_id = auth.uid()
      from public.admins a
      left join auth.users u on u.id = a.user_id
      left join public.members m on m.user_id = a.user_id
     order by a.created_at;
end $$;
revoke execute on function public.list_committee() from public, anon;
grant execute on function public.list_committee() to authenticated;

/** إضافة عضو للجنة برقم هاتفه (يجب أن يكون له حساب في البوابة) */
create or replace function public.add_committee_member(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  p_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if p_phone ~ '^222[234][0-9]{7}$' then p_phone := substr(p_phone, 4); end if;
  if p_phone !~ '^[234][0-9]{7}$' then raise exception 'رقم الهاتف 8 أرقام يبدأ بـ 2 أو 3 أو 4'; end if;
  select id into v_user from auth.users where email = p_phone || '@members.awnwasanad.app';
  if v_user is null then raise exception 'هذا الرقم ليس له حساب بعد: يجب أن يسجّل صاحبه أولاً في بوابة المنتسبين'; end if;
  insert into public.admins (user_id) values (v_user) on conflict (user_id) do nothing;
end $$;
revoke execute on function public.add_committee_member(text) from public, anon;
grant execute on function public.add_committee_member(text) to authenticated;

/** إزالة عضو من اللجنة (لا يزيل العضو نفسه، ويبقى عضو واحد على الأقل) */
create or replace function public.remove_committee_member(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if p_user = auth.uid() then raise exception 'لا يمكنك إزالة نفسك من اللجنة'; end if;
  if (select count(*) from public.admins) <= 1 then raise exception 'يجب أن يبقى عضو واحد على الأقل في اللجنة'; end if;
  delete from public.admins where user_id = p_user;
end $$;
revoke execute on function public.remove_committee_member(uuid) from public, anon;
grant execute on function public.remove_committee_member(uuid) to authenticated;
