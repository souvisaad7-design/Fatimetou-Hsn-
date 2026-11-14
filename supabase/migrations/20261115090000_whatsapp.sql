-- =====================================================================
-- واتساب (WhatsApp Cloud API الرسمي من Meta)
--  - التذكير الشهري بالرسوم، الإشعارات التلقائية (قبول الانتساب، تأكيد/رفض الدفعة)،
--    الرسائل الجماعية من اللجنة، والمساعد الذكي على واتساب.
--  - كل الإرسال من الخادم فقط (Edge Function: whatsapp). المفاتيح مشفّرة في Supabase Vault.
--  - كل الخيارات معطّلة افتراضياً حتى موافقة الإدارة.
--  - لا تغيير على الجداول الموجودة (فقط مشغّلات تُرسل إشعاراً إن فُعّل).
-- =====================================================================

create table if not exists public.wa_settings (
  id boolean primary key default true check (id),
  reminders_enabled boolean not null default false,
  notify_approved boolean not null default false,
  notify_payment boolean not null default false,
  bot_enabled boolean not null default false,
  send_day integer not null default 1 check (send_day between 1 and 28),
  send_hour integer not null default 10 check (send_hour between 0 and 23),
  template_lang text not null default 'ar' check (template_lang ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  tpl_reminder text not null default 'awn_reminder' check (tpl_reminder ~ '^[a-z0-9_]{1,200}$'),
  tpl_approved text not null default 'awn_member_approved' check (tpl_approved ~ '^[a-z0-9_]{1,200}$'),
  tpl_payment_confirmed text not null default 'awn_payment_confirmed' check (tpl_payment_confirmed ~ '^[a-z0-9_]{1,200}$'),
  tpl_payment_rejected text not null default 'awn_payment_rejected' check (tpl_payment_rejected ~ '^[a-z0-9_]{1,200}$'),
  tpl_broadcast text not null default 'awn_committee_message' check (tpl_broadcast ~ '^[a-z0-9_]{1,200}$'),
  pay_phone text not null default '32203250' check (pay_phone ~ '^[0-9]{8}$'),
  site_url text not null default 'https://souvisaad7-design.github.io/Fatimetou-Hsn-/' check (site_url ~ '^https://'),
  connected_at timestamptz,
  phone_display text,
  last_run_at timestamptz,
  last_run_month text,
  last_run_summary jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.wa_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.wa_broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(message) between 2 and 900),
  target text not null check (target in ('all', 'list')),
  list_id uuid references public.lists(id) on delete set null,
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  status text not null default 'sending' check (status in ('sending', 'done')),
  created_by uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  direction text not null default 'out' check (direction in ('out', 'in')),
  kind text not null check (kind in ('reminder', 'approved', 'payment_confirmed', 'payment_rejected', 'broadcast', 'test', 'bot', 'incoming')),
  member_id uuid references public.members(id) on delete set null,
  ref_id uuid,
  broadcast_id uuid references public.wa_broadcasts(id) on delete set null,
  month text check (month is null or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  phone text not null check (phone ~ '^[0-9]{8,15}$'),           -- دولي بدون + (2223xxxxxxx)
  template text,
  params jsonb,
  body text check (char_length(body) <= 4096),
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'read', 'failed', 'received')),
  wa_message_id text,
  error text check (char_length(error) <= 500),
  attempts integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz
);
-- منع التكرار
create unique index if not exists wa_one_reminder_per_member_month on public.wa_messages (member_id, month) where kind = 'reminder';
create unique index if not exists wa_one_notice_per_event on public.wa_messages (ref_id, kind) where kind in ('approved', 'payment_confirmed', 'payment_rejected');
create unique index if not exists wa_one_broadcast_per_member on public.wa_messages (broadcast_id, member_id) where kind = 'broadcast';
create unique index if not exists wa_incoming_once on public.wa_messages (wa_message_id) where direction = 'in';
create index if not exists wa_messages_wamid_idx on public.wa_messages (wa_message_id) where direction = 'out';
create index if not exists wa_messages_created_idx on public.wa_messages (created_at desc);

-- من طلب إيقاف الرسائل (يكتب «توقف» أو STOP)
create table if not exists public.wa_optouts (
  phone text primary key check (phone ~ '^[0-9]{8,15}$'),
  created_at timestamptz not null default now()
);

-- الصلاحيات: اللجنة تقرأ فقط؛ الكتابة من الخادم (مفتاح الخدمة) أو عبر دوال آمنة
alter table public.wa_settings enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_broadcasts enable row level security;
alter table public.wa_optouts enable row level security;
revoke all on public.wa_settings, public.wa_messages, public.wa_broadcasts, public.wa_optouts from anon, authenticated;
grant select on public.wa_settings, public.wa_messages, public.wa_broadcasts, public.wa_optouts to authenticated;
drop policy if exists wa_settings_read on public.wa_settings;
create policy wa_settings_read on public.wa_settings for select to authenticated using (public.is_admin());
drop policy if exists wa_messages_read on public.wa_messages;
create policy wa_messages_read on public.wa_messages for select to authenticated using (public.is_admin());
drop policy if exists wa_broadcasts_read on public.wa_broadcasts;
create policy wa_broadcasts_read on public.wa_broadcasts for select to authenticated using (public.is_admin());
drop policy if exists wa_optouts_read on public.wa_optouts;
create policy wa_optouts_read on public.wa_optouts for select to authenticated using (public.is_admin());

-- ============== الأسرار (Vault) ==============
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'wa_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'wa_cron_secret', 'سرّ الاستدعاءات الداخلية لواتساب');
  end if;
  if not exists (select 1 from vault.secrets where name = 'wa_verify_token') then
    perform vault.create_secret('awn-' || encode(extensions.gen_random_bytes(16), 'hex'), 'wa_verify_token', 'رمز التحقق من Webhook واتساب');
  end if;
end $$;

/** اللجنة تربط حساب واتساب: تُحفظ القيم مشفّرة ولا تُعاد إلى المتصفح أبداً */
create or replace function public.wa_set_credentials(p_phone_number_id text, p_token text, p_app_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  p_phone_number_id := trim(coalesce(p_phone_number_id, ''));
  p_token := trim(coalesce(p_token, ''));
  p_app_secret := trim(coalesce(p_app_secret, ''));
  if p_phone_number_id !~ '^[0-9]{6,25}$' then raise exception 'معرّف رقم الهاتف (Phone number ID) أرقام فقط: انسخه من صفحة WhatsApp > API Setup'; end if;
  if p_token !~ '^[A-Za-z0-9_-]+$' or char_length(p_token) not between 50 and 2000 then raise exception 'رمز الوصول (Access token) غير صحيح: انسخه كاملاً'; end if;
  if p_app_secret !~ '^[a-f0-9]{32}$' then raise exception 'المفتاح السري للتطبيق (App secret) غير صحيح: 32 حرفاً من App settings > Basic'; end if;
  perform public.vault_upsert('wa_phone_number_id', p_phone_number_id, 'WhatsApp phone number id');
  perform public.vault_upsert('wa_access_token', p_token, 'WhatsApp access token');
  perform public.vault_upsert('wa_app_secret', p_app_secret, 'Meta app secret (webhook signature)');
  update public.wa_settings set connected_at = now(), phone_display = null, updated_by = auth.uid(), updated_at = now() where id;
end $$;
revoke execute on function public.wa_set_credentials(text, text, text) from public, anon;
grant execute on function public.wa_set_credentials(text, text, text) to authenticated;

/** رمز التحقق الذي يُلصق في إعدادات Webhook عند Meta (للجنة فقط) */
create or replace function public.wa_webhook_info() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  return json_build_object('verify_token', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_verify_token'));
end $$;
revoke execute on function public.wa_webhook_info() from public, anon;
grant execute on function public.wa_webhook_info() to authenticated;

/** للخادم فقط */
create or replace function public.wa_provider_config() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'phone_number_id', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_phone_number_id'),
    'token', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_access_token'),
    'app_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_app_secret'),
    'verify_token', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_verify_token')
  )
$$;
revoke execute on function public.wa_provider_config() from public, anon, authenticated;
grant execute on function public.wa_provider_config() to service_role;

create or replace function public.wa_check_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_secret <> '' and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'wa_cron_secret'), false)
$$;
revoke execute on function public.wa_check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.wa_check_cron_secret(text) to service_role;

-- ============== الإعدادات ==============
create or replace function public.save_wa_settings(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  update public.wa_settings set
    reminders_enabled = coalesce((p->>'reminders_enabled')::boolean, false),
    notify_approved = coalesce((p->>'notify_approved')::boolean, false),
    notify_payment = coalesce((p->>'notify_payment')::boolean, false),
    bot_enabled = coalesce((p->>'bot_enabled')::boolean, false),
    send_day = (p->>'send_day')::int,
    send_hour = (p->>'send_hour')::int,
    template_lang = trim(p->>'template_lang'),
    tpl_reminder = trim(p->>'tpl_reminder'),
    tpl_approved = trim(p->>'tpl_approved'),
    tpl_payment_confirmed = trim(p->>'tpl_payment_confirmed'),
    tpl_payment_rejected = trim(p->>'tpl_payment_rejected'),
    tpl_broadcast = trim(p->>'tpl_broadcast'),
    pay_phone = trim(p->>'pay_phone'),
    site_url = trim(p->>'site_url'),
    updated_at = now(), updated_by = auth.uid()
  where id;
exception when check_violation or not_null_violation or invalid_text_representation then
  raise exception 'قيمة غير صحيحة في الإعدادات: أسماء القوالب بحروف إنجليزية صغيرة وأرقام و _ فقط، ورقم الدفع 8 أرقام، والرابط يبدأ بـ https://';
end $$;
revoke execute on function public.save_wa_settings(jsonb) from public, anon;
grant execute on function public.save_wa_settings(jsonb) to authenticated;

-- ============== التذكير الشهري ==============
/** حجز رسائل التذكير (ذرّياً، بلا تكرار): المعتمدون الذين لم يسددوا ولم يطلبوا الإيقاف */
create or replace function public.wa_claim_reminders(p_month text, p_limit integer default 300)
returns setof public.wa_messages
language sql security definer set search_path = public as $$
  insert into public.wa_messages (kind, member_id, month, phone, template, params)
  select 'reminder', m.id, p_month, '222' || m.phone, s.tpl_reminder,
         jsonb_build_array(m.full_name, public_month_label(p_month),
           case when m.pledge is not null then m.pledge::text || ' أوقية قديمة' else 'حسب قدرتكم' end, s.pay_phone)
    from public.members m cross join public.wa_settings s
   where s.id
     and m.status = 'approved'
     and m.phone ~ '^[234][0-9]{7}$'
     and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= p_month
     and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = p_month and p.status in ('confirmed', 'pending'))
     and not exists (select 1 from public.wa_optouts o where o.phone = '222' || m.phone)
     and not exists (select 1 from public.wa_messages w where w.kind = 'reminder' and w.month = p_month and w.member_id = m.id)
   order by m.created_at
   limit greatest(coalesce(p_limit, 300), 1)
  on conflict (member_id, month) where kind = 'reminder' do nothing
  returning *
$$;
revoke execute on function public.wa_claim_reminders(text, integer) from public, anon, authenticated;
grant execute on function public.wa_claim_reminders(text, integer) to service_role;

create or replace function public.wa_reminder_preview(p_month text) returns json
language plpgsql stable security definer set search_path = public as $$
declare v_due int; v_sent int;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  select count(*) into v_due from public.members m
   where m.status = 'approved' and m.phone ~ '^[234][0-9]{7}$'
     and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= p_month
     and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = p_month and p.status in ('confirmed', 'pending'))
     and not exists (select 1 from public.wa_optouts o where o.phone = '222' || m.phone);
  select count(*) into v_sent from public.wa_messages w where w.kind = 'reminder' and w.month = p_month;
  return json_build_object('due', v_due, 'already_sent', v_sent, 'remaining',
    (select count(*) from public.members m
      where m.status = 'approved' and m.phone ~ '^[234][0-9]{7}$'
        and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= p_month
        and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = p_month and p.status in ('confirmed', 'pending'))
        and not exists (select 1 from public.wa_optouts o where o.phone = '222' || m.phone)
        and not exists (select 1 from public.wa_messages w where w.kind = 'reminder' and w.month = p_month and w.member_id = m.id)),
    'optouts', (select count(*) from public.wa_optouts),
    'approved', (select count(*) from public.members where status = 'approved'));
end $$;
revoke execute on function public.wa_reminder_preview(text) from public, anon;
grant execute on function public.wa_reminder_preview(text) to authenticated;

-- ============== الرسائل الجماعية ==============
/** عدد من ستصلهم رسالة جماعية (معاينة قبل الإرسال) */
create or replace function public.wa_broadcast_preview(p_list uuid default null) returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  return (select count(*) from public.members m
           where m.status = 'approved' and m.phone ~ '^[234][0-9]{7}$'
             and (p_list is null or m.list_id = p_list)
             and not exists (select 1 from public.wa_optouts o where o.phone = '222' || m.phone));
end $$;
revoke execute on function public.wa_broadcast_preview(uuid) from public, anon;
grant execute on function public.wa_broadcast_preview(uuid) to authenticated;

/** حجز رسائل حملة جماعية (للخادم فقط) */
create or replace function public.wa_claim_broadcast(p_broadcast uuid, p_limit integer default 300)
returns setof public.wa_messages
language sql security definer set search_path = public as $$
  insert into public.wa_messages (kind, member_id, broadcast_id, phone, template, params, body, created_by)
  select 'broadcast', m.id, b.id, '222' || m.phone, s.tpl_broadcast, jsonb_build_array(b.message), b.message, b.created_by
    from public.wa_broadcasts b
    cross join public.wa_settings s
    join public.members m on m.status = 'approved' and m.phone ~ '^[234][0-9]{7}$' and (b.target = 'all' or m.list_id = b.list_id)
   where b.id = p_broadcast and s.id
     and not exists (select 1 from public.wa_optouts o where o.phone = '222' || m.phone)
     and not exists (select 1 from public.wa_messages w where w.kind = 'broadcast' and w.broadcast_id = b.id and w.member_id = m.id)
   order by m.created_at
   limit greatest(coalesce(p_limit, 300), 1)
  on conflict (broadcast_id, member_id) where kind = 'broadcast' do nothing
  returning *
$$;
revoke execute on function public.wa_claim_broadcast(uuid, integer) from public, anon, authenticated;
grant execute on function public.wa_claim_broadcast(uuid, integer) to service_role;

-- ============== الإشعارات التلقائية (مشغّلات) ==============
-- تُرسل طلباً داخلياً إلى دالة الخادم فقط إن كان الإشعار مفعّلاً. أي خطأ هنا لا يمنع حفظ التعديل الأصلي أبداً.
create or replace function public.wa_queue_notice(p_kind text, p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ddgqbyktpkrgewxrnrdf.supabase.co/functions/v1/whatsapp',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_cron_secret')),
    body := jsonb_build_object('action', 'notify', 'kind', p_kind, 'ref_id', p_ref),
    timeout_milliseconds := 30000
  );
exception when others then
  raise warning 'wa_queue_notice: %', sqlerrm;
end $$;
revoke execute on function public.wa_queue_notice(text, uuid) from public, anon, authenticated;

create or replace function public.wa_on_member_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved'
     and exists (select 1 from public.wa_settings where id and notify_approved) then
    perform public.wa_queue_notice('approved', new.id);
  end if;
  return null;
exception when others then
  raise warning 'wa_on_member_change: %', sqlerrm;
  return null;
end $$;
revoke execute on function public.wa_on_member_change() from public, anon, authenticated;
drop trigger if exists wa_member_notice on public.members;
create trigger wa_member_notice after update of status on public.members
  for each row execute function public.wa_on_member_change();

create or replace function public.wa_on_payment_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('confirmed', 'rejected')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and exists (select 1 from public.wa_settings where id and notify_payment) then
    perform public.wa_queue_notice(case new.status when 'confirmed' then 'payment_confirmed' else 'payment_rejected' end, new.id);
  end if;
  return null;
exception when others then
  raise warning 'wa_on_payment_change: %', sqlerrm;
  return null;
end $$;
revoke execute on function public.wa_on_payment_change() from public, anon, authenticated;
drop trigger if exists wa_payment_notice on public.payments;
create trigger wa_payment_notice after insert or update of status on public.payments
  for each row execute function public.wa_on_payment_change();

-- ============== المهمة المجدولة للتذكير الشهري ==============
create or replace function public.wa_cron_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'scheduled', exists (select 1 from cron.job where jobname = 'wa-reminders-hourly' and active),
    'last_run', (select json_build_object('at', d.start_time, 'status', d.status)
                   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                  where j.jobname = 'wa-reminders-hourly' order by d.start_time desc limit 1)
  )
$$;
revoke execute on function public.wa_cron_status() from public, anon, authenticated;
grant execute on function public.wa_cron_status() to service_role;

select cron.unschedule('wa-reminders-hourly') where exists (select 1 from cron.job where jobname = 'wa-reminders-hourly');
select cron.schedule(
  'wa-reminders-hourly',
  '13 * * * *',
  $job$
    select net.http_post(
      url := 'https://ddgqbyktpkrgewxrnrdf.supabase.co/functions/v1/whatsapp',
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_cron_secret')),
      body := '{"action":"scheduled"}'::jsonb,
      timeout_milliseconds := 150000
    );
  $job$
);
