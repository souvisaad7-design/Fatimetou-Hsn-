-- «حجز» رسائل التذكير لشهر معيّن داخل قاعدة البيانات (ذرّياً):
-- يختار المنتسبين المعتمدين الذين لم يسددوا (لا دفعة مؤكدة ولا قيد التأكيد) ويُدرج لكل منهم صفاً «قيد الانتظار».
-- الفهرس الفريد (member_id, month) يمنع أي تكرار حتى لو شُغّلت المهمة مرتين في الوقت نفسه.
-- لا يُعيد إلا الصفوف الجديدة، فيرسلها الخادم مرة واحدة فقط.
-- للخادم فقط (service_role)؛ غير متاحة للمتصفح.
create or replace function public.public_month_label(p_month text) returns text
language sql immutable as $$
  select (array['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'])[split_part(p_month, '-', 2)::int]
         || ' ' || split_part(p_month, '-', 1)
$$;

create or replace function public.sms_claim_reminders(p_month text, p_limit integer default 300)
returns setof public.sms_messages
language sql security definer set search_path = public as $$
  insert into public.sms_messages (kind, member_id, month, phone, network, body)
  select 'reminder', m.id, p_month, m.phone,
         case left(m.phone, 1) when '2' then 'Chinguitel' when '3' then 'Mattel' when '4' then 'Mauritel' end,
         left(replace(replace(replace((select template from public.sms_settings where id),
              '{اسم_المنتسب}', m.full_name), '{name}', m.full_name), '{الشهر}', public_month_label(p_month)), 700)
    from public.members m
   where m.status = 'approved'
     and m.phone ~ '^[234][0-9]{7}$'
     and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= p_month
     and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = p_month and p.status in ('confirmed', 'pending'))
     and not exists (select 1 from public.sms_messages s where s.kind = 'reminder' and s.month = p_month and s.member_id = m.id)
   order by m.created_at
   limit greatest(coalesce(p_limit, 300), 1)
  on conflict (member_id, month) where kind = 'reminder' do nothing
  returning *
$$;

revoke execute on function public.sms_claim_reminders(text, integer) from public, anon, authenticated;
grant execute on function public.sms_claim_reminders(text, integer) to service_role;

/** عدد من ستصلهم رسالة التذكير لهذا الشهر (معاينة للجنة قبل الإرسال) */
create or replace function public.sms_reminder_preview(p_month text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  return json_build_object(
    'due', (select count(*) from public.members m
             where m.status = 'approved' and m.phone ~ '^[234][0-9]{7}$'
               and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= p_month
               and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = p_month and p.status in ('confirmed', 'pending'))),
    'already_sent', (select count(*) from public.sms_messages s where s.kind = 'reminder' and s.month = p_month),
    'remaining', (select count(*) from public.members m
             where m.status = 'approved' and m.phone ~ '^[234][0-9]{7}$'
               and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= p_month
               and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = p_month and p.status in ('confirmed', 'pending'))
               and not exists (select 1 from public.sms_messages s where s.kind = 'reminder' and s.month = p_month and s.member_id = m.id))
  );
end $$;
revoke execute on function public.sms_reminder_preview(text) from public, anon;
grant execute on function public.sms_reminder_preview(text) to authenticated;
