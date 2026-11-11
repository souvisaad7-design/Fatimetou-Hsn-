-- =====================================================================
-- التذكير برسوم الانتساب عبر SMS
--  - sms_settings: إعدادات الإرسال التلقائي (معطّل افتراضياً حتى موافقة الإدارة)
--  - sms_messages: سجل كل رسالة وحالتها (قيد الانتظار / نجحت / فشلت)
--  - رسالة تذكير واحدة فقط لكل منتسب عن كل شهر (فهرس فريد)، حتى لو أعيد تشغيل المهمة
-- الإرسال الفعلي من الخادم فقط (Edge Function: sms-reminders)، ومفاتيح المزوّد في متغيرات البيئة.
-- لا تغيير على الجداول الموجودة.
-- =====================================================================

create table if not exists public.sms_settings (
  id boolean primary key default true check (id),            -- صف واحد فقط
  enabled boolean not null default false,                      -- الإرسال التلقائي (معطّل حتى الموافقة)
  send_day integer not null default 1 check (send_day between 1 and 28),
  send_hour integer not null default 10 check (send_hour between 0 and 23),   -- بتوقيت نواكشوط (= UTC)
  template text not null default 'السلام عليكم {اسم_المنتسب}، نذكركم بأن رسوم الانتساب الشهرية لجمعية عون وسند الخيرية مستحقة لهذا الشهر. نرجو تسديد الرسوم، وشكراً لدعمكم للجمعية.'
    check (char_length(template) between 10 and 600),
  last_run_at timestamptz,
  last_run_month text,
  last_run_summary jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.sms_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reminder', 'test')),
  member_id uuid references public.members(id) on delete set null,
  month text check (month is null or month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  phone text not null check (phone ~ '^[234][0-9]{7}$'),
  network text,                                                -- Chinguitel / Mattel / Mauritel
  body text not null check (char_length(body) <= 700),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider text,
  provider_message_id text,
  error text check (char_length(error) <= 500),
  attempts integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
-- منع التكرار: تذكير واحد لكل منتسب عن كل شهر
create unique index if not exists sms_one_reminder_per_member_month
  on public.sms_messages (member_id, month) where kind = 'reminder';
create index if not exists sms_messages_created_idx on public.sms_messages (created_at desc);
create index if not exists sms_messages_month_idx on public.sms_messages (month, status);

-- الصلاحيات: اللجنة تقرأ فقط؛ لا كتابة من المتصفح (الدالة على الخادم تكتب بمفتاح الخدمة)
alter table public.sms_settings enable row level security;
alter table public.sms_messages enable row level security;
revoke all on public.sms_settings, public.sms_messages from anon, authenticated;
grant select on public.sms_settings, public.sms_messages to authenticated;
drop policy if exists sms_settings_read on public.sms_settings;
create policy sms_settings_read on public.sms_settings for select to authenticated using (public.is_admin());
drop policy if exists sms_messages_read on public.sms_messages;
create policy sms_messages_read on public.sms_messages for select to authenticated using (public.is_admin());

/** حفظ إعدادات التذكير (للجنة فقط) */
create or replace function public.save_sms_settings(p_enabled boolean, p_day integer, p_hour integer, p_template text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if p_day is null or p_day not between 1 and 28 then raise exception 'يوم الإرسال من 1 إلى 28'; end if;
  if p_hour is null or p_hour not between 0 and 23 then raise exception 'ساعة الإرسال من 0 إلى 23'; end if;
  if char_length(trim(coalesce(p_template, ''))) < 10 then raise exception 'نص الرسالة قصير جداً'; end if;
  if char_length(p_template) > 600 then raise exception 'نص الرسالة طويل جداً (600 حرف كحد أقصى)'; end if;
  update public.sms_settings
     set enabled = coalesce(p_enabled, false), send_day = p_day, send_hour = p_hour, template = trim(p_template),
         updated_at = now(), updated_by = auth.uid()
   where id;
end $$;

revoke execute on function public.save_sms_settings(boolean, integer, integer, text) from public, anon;
grant execute on function public.save_sms_settings(boolean, integer, integer, text) to authenticated;
