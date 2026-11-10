-- دمج تعديلين طُبّقا على report_payment في الوقت نفسه تقريباً:
--  receipt_on_register: صاحب طلب الانتساب الذي لم يُقبل بعد يستطيع إرسال إيصال، ويبقى «قيد التأكيد»
--  one_payment_per_month: دفعة واحدة لكل منتسب في الشهر؛ بلاغ جديد يحدّث البلاغ المنتظر بدل إضافة دفعة ثانية
create or replace function public.report_payment(p_month text, p_amount integer, p_method text, p_reference text, p_receipt text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_member uuid := public.my_member_id(); v_id uuid;
begin
  if v_member is null or not exists (select 1 from public.members where id = v_member and status in ('pending', 'approved', 'suspended')) then
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
