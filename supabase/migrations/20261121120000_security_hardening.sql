-- =====================================================================
-- تقوية الحماية (مراجعة أمنية شاملة):
-- 1) سحب صلاحيات غير لازمة (TRUNCATE/TRIGGER/REFERENCES) من الزوار والمستخدمين على كل الجداول، وللجداول القادمة أيضاً.
-- 2) القوائم ومشرفوها (وأرقام هواتفهم) لا يراها إلا اللجنة والمنتسبون المعتمدون والمشرفون وصاحب الطلب لقائمته فقط
--    (لا يراها شخص أنشأ حساباً مباشرة دون أن يكون منتسباً).
-- 3) التبرع من البوابة للمنتسبين فقط، مع حدّ لمنع الإغراق (10 تبرعات قيد المراجعة في اليوم).
-- 4) تثبيت مسار البحث لدالة public_month_label.
-- 5) حدّ لعدد طلبات الانتساب الجديدة (منع إنشاء حسابات بالجملة) — تستعمله دالة التسجيل.
-- =====================================================================
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

alter function public.public_month_label(text) set search_path = public;

drop policy if exists lists_read on public.lists;
create policy lists_read on public.lists for select to authenticated using (
  public.is_admin()
  or public.is_approved_member()
  or supervisor_user_id = auth.uid()
  or id in (select m.list_id from public.members m where m.user_id = auth.uid())
);

create or replace function public.add_donation(p_campaign uuid, p_donor_name text, p_donor_phone text, p_amount integer, p_method text, p_reference text, p_member uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_admin boolean := public.is_admin(); v_member uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  if not v_admin and public.my_member_id() is null then raise exception 'التبرع من البوابة للمنتسبين فقط'; end if;
  if not exists (select 1 from public.campaigns where id = p_campaign and (active or v_admin)) then raise exception 'الحملة غير متاحة'; end if;
  if not v_admin and (select count(*) from public.donations d where d.member_id = public.my_member_id() and d.status = 'pending' and d.created_at > now() - interval '1 day') >= 10 then
    raise exception 'لديك تبرعات كثيرة قيد المراجعة، انتظر تأكيدها من اللجنة';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'مبلغ غير صحيح'; end if;
  v_member := case when v_admin then p_member else public.my_member_id() end;
  insert into public.donations (campaign_id, member_id, donor_name, donor_phone, amount, method, reference, status)
  values (p_campaign, v_member, coalesce(nullif(trim(p_donor_name), ''), 'فاعل خير'), nullif(p_donor_phone, ''), p_amount, left(coalesce(p_method, ''), 40), nullif(left(coalesce(p_reference, ''), 80), ''),
          case when v_admin then 'confirmed' else 'pending' end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.add_donation(uuid, text, text, integer, text, text, uuid) from public, anon;
grant execute on function public.add_donation(uuid, text, text, integer, text, text, uuid) to authenticated;

/** للخادم فقط: هل تجاوزت طلبات الانتساب الجديدة الحد؟ (أكثر من 40 طلباً في 10 دقائق) */
create or replace function public.registration_rate_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.members where created_at > now() - interval '10 minutes') < 40
$$;
revoke execute on function public.registration_rate_ok() from public, anon, authenticated;
grant execute on function public.registration_rate_ok() to service_role;

/** للخادم فقط: هل يجوز إعادة استعمال حساب صاحب طلب مرفوض؟ (ليس من اللجنة ولا مشرفاً ولا منتسباً نشطاً) */
create or replace function public.can_reuse_account(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.admins where user_id = p_user)
     and not exists (select 1 from public.lists where supervisor_user_id = p_user)
     and not exists (select 1 from public.members where user_id = p_user and status <> 'rejected')
$$;
revoke execute on function public.can_reuse_account(uuid) from public, anon, authenticated;
grant execute on function public.can_reuse_account(uuid) to service_role;
