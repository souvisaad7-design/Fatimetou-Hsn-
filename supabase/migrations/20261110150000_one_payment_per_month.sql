-- دفعة واحدة فقط لكل منتسب في كل شهر.
-- كانت دفعة المنتسب قد تُسجَّل مرتين (ضغطتان على زر التسجيل، أو بلاغ المنتسب ثم تسجيل المشرف)،
-- فيتضاعف مجموع «انتساب الشهر» في لوحة المعلومات.

-- 1) قاعدة البيانات نفسها ترفض دفعتين غير مرفوضتين لنفس المنتسب ونفس الشهر (حتى مع الضغط المزدوج)
create unique index if not exists payments_one_per_member_month_idx
  on public.payments (member_id, month) where status <> 'rejected';

-- 2) المنتسب يبلغ عن دفعة: إن كان الشهر مدفوعاً يُرفض، وإن كان له بلاغ ينتظر التأكيد يُحدَّث البلاغ نفسه
create or replace function public.report_payment(p_month text, p_amount integer, p_method text, p_reference text, p_receipt text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_member uuid := public.my_member_id(); v_id uuid;
begin
  if v_member is null or not exists (select 1 from public.members where id = v_member and status in ('approved', 'suspended')) then
    raise exception 'حسابك غير معتمد بعد';
  end if;
  perform pg_advisory_xact_lock(hashtext(v_member::text || p_month));
  if exists (select 1 from public.payments where member_id = v_member and month = p_month and status = 'confirmed') then
    raise exception 'هذا الشهر مدفوع من قبل';
  end if;
  select id into v_id from public.payments where member_id = v_member and month = p_month and status = 'pending';
  if v_id is not null then
    update public.payments
       set amount = p_amount, method = p_method, reference = nullif(p_reference, ''),
           receipt = coalesce(nullif(p_receipt, ''), receipt)
     where id = v_id;
    return v_id;
  end if;
  insert into public.payments (member_id, month, amount, method, reference, receipt, status, source)
  values (v_member, p_month, p_amount, p_method, nullif(p_reference, ''), nullif(p_receipt, ''), 'pending', 'member')
  returning id into v_id;
  return v_id;
end $$;

-- 3) المشرف أو المسؤول يسجّل دفعة: إن كان الشهر مدفوعاً يُرفض،
--    وإن كان المنتسب قد أبلغ عن دفعته فيُؤكَّد بلاغه بدل إضافة دفعة ثانية
create or replace function public.record_payment(p_member uuid, p_month text, p_amount integer, p_method text, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_member(p_member) then raise exception 'ليست لديك صلاحية'; end if;
  perform pg_advisory_xact_lock(hashtext(p_member::text || p_month));
  if exists (select 1 from public.payments where member_id = p_member and month = p_month and status = 'confirmed') then
    raise exception 'هذا الشهر مدفوع من قبل';
  end if;
  select id into v_id from public.payments where member_id = p_member and month = p_month and status = 'pending';
  if v_id is not null then
    update public.payments
       set status = 'confirmed', amount = p_amount, method = p_method, reference = coalesce(nullif(p_reference, ''), reference)
     where id = v_id;
    return v_id;
  end if;
  insert into public.payments (member_id, month, amount, method, reference, status, source)
  values (p_member, p_month, p_amount, p_method, nullif(p_reference, ''), 'confirmed', 'admin')
  returning id into v_id;
  return v_id;
end $$;

-- 4) إعادة دفعة مرفوضة إلى «بانتظار التأكيد» أو «مؤكدة» تُرفض إن كان للشهر دفعة أخرى
create or replace function public.set_payment_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_member uuid; v_month text;
begin
  if p_status not in ('pending', 'confirmed', 'rejected') then raise exception 'حالة غير صحيحة'; end if;
  select member_id, month into v_member, v_month from public.payments where id = p_id;
  if not public.can_manage_member(v_member) then raise exception 'ليست لديك صلاحية'; end if;
  if p_status <> 'rejected' and exists (
    select 1 from public.payments where member_id = v_member and month = v_month and status <> 'rejected' and id <> p_id
  ) then
    raise exception 'هذا الشهر مدفوع من قبل';
  end if;
  update public.payments set status = p_status where id = p_id;
end $$;
