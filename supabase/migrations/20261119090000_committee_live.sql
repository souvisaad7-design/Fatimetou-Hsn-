-- =====================================================================
-- البث المباشر الخاص باللجنة الانتسابية (من الموقع نفسه عبر LiveKit)
--  - يبث أعضاء اللجنة فقط (كاميرا/مايكروفون/مشاركة الشاشة)، ويشاهد المنتسبون المعتمدون فقط بعد الدخول.
--  - رمز الدخول إلى البث يُصدره الخادم (Edge Function: live-token) بعد التحقق من الصلاحية.
--  - مفاتيح LiveKit مشفّرة في Supabase Vault.
-- لا تغيير على الجداول الموجودة.
-- =====================================================================

create table if not exists public.live_settings (
  id boolean primary key default true check (id),
  livekit_url text check (livekit_url is null or livekit_url ~ '^wss://[A-Za-z0-9.-]+$'),
  comments_enabled boolean not null default true,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.live_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  room text not null default ('awn-' || replace(gen_random_uuid()::text, '-', '')),
  peak_viewers integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists live_sessions_one_live on public.live_sessions ((true)) where status = 'live';
create index if not exists live_sessions_status_idx on public.live_sessions (status, scheduled_at);

create table if not exists public.live_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  member_id uuid references public.members(id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 120),
  is_committee boolean not null default false,
  body text not null check (char_length(body) between 1 and 500),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists live_comments_session_idx on public.live_comments (session_id, created_at);

/** منتسب معتمد؟ (المشاهدة والتعليق للمعتمدين فقط) */
create or replace function public.is_approved_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and status = 'approved')
$$;
revoke execute on function public.is_approved_member() from public, anon;
grant execute on function public.is_approved_member() to authenticated;

-- الصلاحيات: القراءة للجنة والمنتسبين المعتمدين فقط؛ لا كتابة مباشرة
alter table public.live_settings enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_comments enable row level security;
revoke all on public.live_settings, public.live_sessions, public.live_comments from anon, authenticated;
grant select on public.live_settings, public.live_sessions, public.live_comments to authenticated;
drop policy if exists live_settings_read on public.live_settings;
create policy live_settings_read on public.live_settings for select to authenticated using (public.is_admin() or public.is_approved_member());
drop policy if exists live_sessions_read on public.live_sessions;
create policy live_sessions_read on public.live_sessions for select to authenticated using (public.is_admin() or public.is_approved_member());
drop policy if exists live_comments_read on public.live_comments;
create policy live_comments_read on public.live_comments for select to authenticated
  using (public.is_admin() or (public.is_approved_member() and not hidden));

-- ============== اللجنة ==============
create or replace function public.live_set_credentials(p_url text, p_key text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  p_url := trim(coalesce(p_url, '')); p_key := trim(coalesce(p_key, '')); p_secret := trim(coalesce(p_secret, ''));
  if p_url !~ '^wss://[A-Za-z0-9.-]+$' then raise exception 'رابط المشروع يبدأ بـ wss:// (مثل wss://awn-xxxx.livekit.cloud)'; end if;
  if p_key !~ '^[A-Za-z0-9]{8,64}$' then raise exception 'API Key غير صحيح: انسخه كما هو من LiveKit'; end if;
  if p_secret !~ '^[A-Za-z0-9]{20,128}$' then raise exception 'API Secret غير صحيح: انسخه كاملاً من LiveKit'; end if;
  perform public.vault_upsert('livekit_api_key', p_key, 'LiveKit API key');
  perform public.vault_upsert('livekit_api_secret', p_secret, 'LiveKit API secret');
  update public.live_settings set livekit_url = p_url, connected_at = now(), updated_at = now(), updated_by = auth.uid() where id;
end $$;
revoke execute on function public.live_set_credentials(text, text, text) from public, anon;
grant execute on function public.live_set_credentials(text, text, text) to authenticated;

/** للخادم فقط */
create or replace function public.live_provider_config() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'url', (select livekit_url from public.live_settings where id),
    'key', (select decrypted_secret from vault.decrypted_secrets where name = 'livekit_api_key'),
    'secret', (select decrypted_secret from vault.decrypted_secrets where name = 'livekit_api_secret')
  )
$$;
revoke execute on function public.live_provider_config() from public, anon, authenticated;
grant execute on function public.live_provider_config() to service_role;

create or replace function public.save_live_session(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if v_id is null then
    insert into public.live_sessions (title, description, scheduled_at)
    values (trim(p->>'title'), coalesce(trim(p->>'description'), ''), nullif(p->>'scheduled_at', '')::timestamptz)
    returning id into v_id;
  else
    update public.live_sessions set title = trim(p->>'title'), description = coalesce(trim(p->>'description'), ''),
      scheduled_at = nullif(p->>'scheduled_at', '')::timestamptz
    where id = v_id and status <> 'ended';
    if not found then raise exception 'البث غير موجود أو انتهى'; end if;
  end if;
  return v_id;
exception when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format then
  raise exception 'بيانات البث غير صحيحة: العنوان من 2 إلى 160 حرفاً';
end $$;
revoke execute on function public.save_live_session(jsonb) from public, anon;
grant execute on function public.save_live_session(jsonb) to authenticated;

/** بدء البث أو إنهاؤه. بدء بث ينهي أي بث آخر جارٍ */
create or replace function public.set_live_session_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if p_status not in ('live', 'ended') then raise exception 'حالة غير صحيحة'; end if;
  if p_status = 'live' then
    update public.live_sessions set status = 'ended', ended_at = now() where status = 'live' and id <> p_id;
    update public.live_sessions set status = 'live', started_at = coalesce(started_at, now()), ended_at = null where id = p_id and status <> 'ended';
  else
    update public.live_sessions set status = 'ended', ended_at = now() where id = p_id and status <> 'ended';
  end if;
  if not found then raise exception 'البث غير موجود أو انتهى'; end if;
end $$;
revoke execute on function public.set_live_session_status(uuid, text) from public, anon;
grant execute on function public.set_live_session_status(uuid, text) to authenticated;

create or replace function public.delete_live_session(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.live_sessions where id = p_id and status <> 'live';
  if not found then raise exception 'لا يمكن حذف بث جارٍ؛ أنهِه أولاً'; end if;
end $$;
revoke execute on function public.delete_live_session(uuid) from public, anon;
grant execute on function public.delete_live_session(uuid) to authenticated;

create or replace function public.set_live_comments(p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  update public.live_settings set comments_enabled = coalesce(p_enabled, true), updated_at = now(), updated_by = auth.uid() where id;
end $$;
revoke execute on function public.set_live_comments(boolean) from public, anon;
grant execute on function public.set_live_comments(boolean) to authenticated;

create or replace function public.hide_live_comment(p_id uuid, p_hidden boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  update public.live_comments set hidden = coalesce(p_hidden, true) where id = p_id;
end $$;
revoke execute on function public.hide_live_comment(uuid, boolean) from public, anon;
grant execute on function public.hide_live_comment(uuid, boolean) to authenticated;

/** الخادم يسجّل أعلى عدد للمشاهدين */
create or replace function public.live_record_viewers(p_id uuid, p_count integer) returns void
language sql security definer set search_path = public as $$
  update public.live_sessions set peak_viewers = greatest(peak_viewers, coalesce(p_count, 0)) where id = p_id
$$;
revoke execute on function public.live_record_viewers(uuid, integer) from public, anon, authenticated;
grant execute on function public.live_record_viewers(uuid, integer) to service_role;

-- ============== المنتسبون ==============
/** تعليق أو سؤال أثناء البث (المعتمدون واللجنة؛ تعليق واحد كل 5 ثوانٍ) */
create or replace function public.post_live_comment(p_session uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare v_admin boolean := public.is_admin(); v_member public.members%rowtype; v_name text;
begin
  select * into v_member from public.members where user_id = auth.uid() and status = 'approved';
  if not v_admin and v_member.id is null then raise exception 'التعليق للمنتسبين المعتمدين فقط'; end if;
  if not exists (select 1 from public.live_settings where id and comments_enabled) and not v_admin then raise exception 'التعليقات متوقفة الآن'; end if;
  if not exists (select 1 from public.live_sessions where id = p_session and status = 'live') then raise exception 'البث غير جارٍ'; end if;
  p_body := trim(coalesce(p_body, ''));
  if char_length(p_body) < 1 or char_length(p_body) > 500 then raise exception 'التعليق من 1 إلى 500 حرف'; end if;
  if exists (select 1 from public.live_comments where user_id = auth.uid() and created_at > now() - interval '5 seconds') then
    raise exception 'انتظر لحظات قبل التعليق مرة أخرى';
  end if;
  v_name := coalesce(v_member.full_name, 'اللجنة الانتسابية');
  insert into public.live_comments (session_id, member_id, author_name, is_committee, body)
  values (p_session, v_member.id, v_name, v_admin, p_body);
end $$;
revoke execute on function public.post_live_comment(uuid, text) from public, anon;
grant execute on function public.post_live_comment(uuid, text) to authenticated;
