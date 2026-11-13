-- ربط مزوّد الرسائل من لوحة الإدارة مباشرة (بدل لوحة Supabase):
-- اللجنة تُدخل المفتاح والرمز السري مرة واحدة، فيُحفظان مشفّرين في Supabase Vault.
-- لا يمكن قراءتهما بعد ذلك من المتصفح؛ دالة الخادم وحدها (service_role) تقرؤهما عند الإرسال.
-- متغيرات البيئة (Secrets) إن وُجدت تبقى لها الأولوية.

alter table public.sms_settings
  add column if not exists provider text check (provider is null or provider in ('chinguisoft', 'twilio', 'infobip', 'http')),
  add column if not exists provider_updated_at timestamptz;

create or replace function public.vault_upsert(p_name text, p_value text, p_description text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from vault.secrets where name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name, p_description);
  else
    perform vault.update_secret(v_id, p_value, p_name, p_description);
  end if;
end $$;
revoke execute on function public.vault_upsert(text, text, text) from public, anon, authenticated;

/** اللجنة تربط Chinguisoft: المفتاح والرمز السري يُحفظان مشفّرين (لا يُعادان أبداً إلى المتصفح) */
create or replace function public.sms_set_chinguisoft(p_key text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  p_key := trim(coalesce(p_key, ''));
  p_token := trim(coalesce(p_token, ''));
  if p_key !~ '^[A-Za-z0-9_-]{6,100}$' then raise exception 'المفتاح غير صحيح: انسخه كما هو من صفحة الحملة في Chinguisoft'; end if;
  if p_token !~ '^[A-Za-z0-9_-]{10,200}$' then raise exception 'الرمز السري غير صحيح: انسخه كما هو من صفحة الحملة في Chinguisoft'; end if;
  perform public.vault_upsert('sms_chinguisoft_key', p_key, 'Chinguisoft campaign key');
  perform public.vault_upsert('sms_chinguisoft_token', p_token, 'Chinguisoft Campaign-token');
  update public.sms_settings set provider = 'chinguisoft', provider_updated_at = now(), updated_by = auth.uid() where id;
end $$;
revoke execute on function public.sms_set_chinguisoft(text, text) from public, anon;
grant execute on function public.sms_set_chinguisoft(text, text) to authenticated;

/** للخادم فقط: إعدادات المزوّد مع القيم السرية */
create or replace function public.sms_provider_config() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'provider', (select provider from public.sms_settings where id),
    'chinguisoft_key', (select decrypted_secret from vault.decrypted_secrets where name = 'sms_chinguisoft_key'),
    'chinguisoft_token', (select decrypted_secret from vault.decrypted_secrets where name = 'sms_chinguisoft_token')
  )
$$;
revoke execute on function public.sms_provider_config() from public, anon, authenticated;
grant execute on function public.sms_provider_config() to service_role;
