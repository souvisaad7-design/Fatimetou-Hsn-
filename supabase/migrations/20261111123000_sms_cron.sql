-- =====================================================================
-- المهمة المجدولة لتذكيرات SMS (مستقلة عن فتح الموقع)
-- pg_cron يستدعي دالة الخادم sms-reminders كل ساعة. الدالة لا ترسل شيئاً إلا إذا:
--   الإرسال التلقائي مفعّل في الإعدادات + حلّ يوم الإرسال وساعته + لم تُرسَل تذكيرات هذا الشهر.
-- منع التكرار مضمون في قاعدة البيانات (sms_claim_reminders + فهرس فريد)، فتشغيلها كل ساعة آمن.
-- سرّ المهمة عشوائي، يُولَّد هنا ويُحفظ مشفّراً في Supabase Vault (لا يظهر في الكود ولا في GitHub).
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- السرّ: يُنشأ مرة واحدة فقط
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'sms_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'sms_cron_secret', 'سرّ المهمة المجدولة لتذكيرات SMS');
  end if;
end $$;

/** تتحقق دالة الخادم من سرّ المهمة دون أن تعرفه (للخادم فقط) */
create or replace function public.sms_check_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_secret <> '' and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'sms_cron_secret'), false)
$$;
revoke execute on function public.sms_check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.sms_check_cron_secret(text) to service_role;

/** حالة المهمة المجدولة (للعرض في لوحة الإدارة) */
create or replace function public.sms_cron_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'scheduled', exists (select 1 from cron.job where jobname = 'sms-reminders-hourly' and active),
    'schedule', (select schedule from cron.job where jobname = 'sms-reminders-hourly'),
    'last_run', (select json_build_object('at', d.start_time, 'status', d.status)
                   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                  where j.jobname = 'sms-reminders-hourly' order by d.start_time desc limit 1)
  )
$$;
revoke execute on function public.sms_cron_status() from public, anon, authenticated;
grant execute on function public.sms_cron_status() to service_role;

-- كل ساعة عند الدقيقة 7 (بتوقيت نواكشوط = UTC)
select cron.unschedule('sms-reminders-hourly') where exists (select 1 from cron.job where jobname = 'sms-reminders-hourly');
select cron.schedule(
  'sms-reminders-hourly',
  '7 * * * *',
  $job$
    select net.http_post(
      url := 'https://ddgqbyktpkrgewxrnrdf.supabase.co/functions/v1/sms-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sms_cron_secret')
      ),
      body := '{"action":"scheduled"}'::jsonb,
      timeout_milliseconds := 150000
    );
  $job$
);
