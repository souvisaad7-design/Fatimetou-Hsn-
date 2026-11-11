-- =====================================================================
-- لوحة تحكم بالمحادثة للجنة الانتساب (البوت) — مبنية على الجداول الموجودة
--
-- الأدوار تُحدَّد من الحساب المسجّل (auth.uid()) وحده، لا من نص المحادثة:
--   لجنة (الانتساب، المالية، الرئيس...): صف في public.admins  → ترى الجميع
--   مشرف قائمة: lists.supervisor_user_id                      → يرى منتسبي قائمته فقط
--   منتسب عادي: members.user_id                               → يرى نفسه فقط
--
-- كل الدوال الجديدة إما SECURITY INVOKER (فتطبَّق RLS على كل صف تقرؤه)، وتتحقق من الدور صراحةً أيضاً،
-- وإما SECURITY DEFINER لا تعيد إلا بيانات صاحب الطلب نفسه.
-- لا حذف للدفعات: الإلغاء والتصحيح قيود جديدة، وكل تغيير يُسجَّل في audit_log.
-- =====================================================================

-- ---------- 1) دور عضو اللجنة (لعرضه فقط؛ كل أعضاء اللجنة لهم الصلاحيات نفسها) ----------
alter table public.admins
  add column if not exists role text not null default 'committee'
    check (role in ('president', 'membership', 'finance', 'committee'));

-- ---------- 2) الدفعات: الإلغاء والتصحيح بدل الحذف ----------
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'confirmed', 'rejected', 'cancelled'));
alter table public.payments
  add column if not exists kind text not null default 'payment' check (kind in ('payment', 'correction')),
  add column if not exists corrects uuid references public.payments(id),
  add column if not exists note text check (char_length(note) <= 300),
  add column if not exists cancelled_by uuid,
  add column if not exists cancelled_at timestamptz;

-- دفعة ثانية في نفس الشهر صارت ممكنة بعد تأكيد صريح (p_allow_second)، فالمنع ينتقل من الفهرس إلى الدالة
drop index if exists public.payments_one_per_member_month_idx;

-- لا حذف للدفعات أبداً (حتى من لوحة Supabase)؛ الإلغاء يغيّر الحالة إلى cancelled
create or replace function public.forbid_payment_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'لا يمكن حذف الدفعات؛ استعمل الإلغاء أو التصحيح';
end $$;
drop trigger if exists payments_no_delete on public.payments;
create trigger payments_no_delete before delete on public.payments for each row execute function public.forbid_payment_delete();

-- ---------- 3) سجل التدقيق ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,                 -- auth.uid() لمن نفّذ العملية (null = النظام)
  actor_role text not null,   -- committee / supervisor / member / system
  action text not null,       -- insert / update / delete
  entity text not null,       -- اسم الجدول
  entity_id text,
  member_id uuid,
  old_data jsonb,
  new_data jsonb
);
create index if not exists audit_log_member_idx on public.audit_log (member_id, at desc);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

create or replace function public.audit_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'receipt' - 'has_receipt' end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'receipt' - 'has_receipt' end;
  v_row jsonb := coalesce(v_new, v_old);
begin
  if tg_op = 'UPDATE' and v_old = v_new then return new; end if;
  insert into public.audit_log (actor, actor_role, action, entity, entity_id, member_id, old_data, new_data)
  values (
    auth.uid(),
    case when auth.uid() is null then 'system' when public.is_admin() then 'committee' when public.is_supervisor() then 'supervisor' else 'member' end,
    lower(tg_op), tg_table_name,
    coalesce(v_row->>'id', v_row->>'user_id'),
    case tg_table_name when 'members' then (v_row->>'id')::uuid when 'payments' then (v_row->>'member_id')::uuid else null end,
    v_old, v_new
  );
  return coalesce(new, old);
end $$;

drop trigger if exists audit_payments on public.payments;
create trigger audit_payments after insert or update or delete on public.payments for each row execute function public.audit_changes();
drop trigger if exists audit_members on public.members;
create trigger audit_members after insert or update or delete on public.members for each row execute function public.audit_changes();
drop trigger if exists audit_lists on public.lists;
create trigger audit_lists after insert or update or delete on public.lists for each row execute function public.audit_changes();
drop trigger if exists audit_admins on public.admins;
create trigger audit_admins after insert or update or delete on public.admins for each row execute function public.audit_changes();

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated using (public.is_admin());

-- ---------- 4) إشعارات المنتسبين («تم تسجيل انتسابك...») ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  kind text not null check (kind in ('payment_recorded')),
  data jsonb not null default '{}'::jsonb,
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_member_idx on public.notifications (member_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using (member_id = public.my_member_id());

create or replace function public.mark_my_notifications_read() returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where member_id = public.my_member_id() and read_at is null
$$;

-- ---------- 5) أدوات مشتركة ----------
/** توحيد النص العربي للبحث: حذف التشكيل والتطويل، وتوحيد الهمزات والياء والتاء المربوطة */
create or replace function public.normalize_ar(t text) returns text
language sql immutable parallel safe as $$
  select trim(regexp_replace(lower(translate(
    regexp_replace(coalesce(t, ''), '[ً-ْٰـ]', '', 'g'),
    'أإآٱىةؤئ', 'اااايهوي')), '\s+', ' ', 'g'))
$$;

create or replace function public.ar_month_label(p_month text) returns text
language sql immutable as $$
  select (array['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'])[split_part(p_month, '-', 2)::int]
         || ' ' || split_part(p_month, '-', 1)
$$;

create or replace function public.current_month() returns text
language sql stable as $$ select to_char(now() at time zone 'Africa/Nouakchott', 'YYYY-MM') $$;

/** هل المستخدم الحالي من اللجنة أو مشرف قائمة؟ */
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_supervisor()
$$;

/**
 * عدد الأشهر المتتالية غير المدفوعة حتى الشهر الحالي (آخر 12 شهراً، منذ الاعتماد).
 * مطابق لحساب «الالتزام» في الواجهة: الدفعة المنتظرة التأكيد لا تُعدّ تأخراً.
 * لا يعيد شيئاً إلا لمن يحق له رؤية هذا المنتسب.
 */
create or replace function public.unpaid_streak(p_member uuid) returns integer
language sql stable security invoker set search_path = public as $$
  select case when not (public.can_manage_member(p_member) or p_member = public.my_member_id()) then null else (
    select coalesce(min(s.i), 12)::int
    from (select i, to_char(date_trunc('month', (now() at time zone 'Africa/Nouakchott')) - make_interval(months => i), 'YYYY-MM') as mon
          from generate_series(0, 11) i) s,
         (select to_char(coalesce(approved_at, created_at), 'YYYY-MM') as start from public.members where id = p_member) m
    where s.mon < m.start
       or exists (select 1 from public.payments p where p.member_id = p_member and p.month = s.mon and p.status in ('pending', 'confirmed'))
  ) end
$$;

-- ---------- 6) تسجيل الدفعات: تأكيد صريح للدفعة الثانية، وإشعار شكر للمنتسب ----------
drop function if exists public.record_payment(uuid, text, integer, text, text);
create or replace function public.record_payment(
  p_member uuid, p_month text, p_amount integer, p_method text, p_reference text default '',
  p_allow_second boolean default false, p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_member(p_member) then raise exception 'ليست لديك صلاحية'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  if not exists (select 1 from public.members where id = p_member and status in ('approved', 'suspended')) then
    raise exception 'المنتسب غير معتمد';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_member::text || p_month));
  if not p_allow_second and exists (select 1 from public.payments where member_id = p_member and month = p_month and status = 'confirmed') then
    raise exception 'هذا الشهر مدفوع من قبل';
  end if;
  -- بلاغ المنتسب المنتظر يُؤكَّد بدل إضافة دفعة ثانية
  if not p_allow_second then
    select id into v_id from public.payments where member_id = p_member and month = p_month and status = 'pending' limit 1;
  end if;
  if v_id is not null then
    update public.payments
       set status = 'confirmed', amount = p_amount, method = p_method,
           reference = coalesce(nullif(p_reference, ''), reference), note = coalesce(p_note, note)
     where id = v_id;
  else
    insert into public.payments (member_id, month, amount, method, reference, status, source, note)
    values (p_member, p_month, p_amount, p_method, nullif(p_reference, ''), 'confirmed', 'admin', p_note)
    returning id into v_id;
  end if;
  insert into public.notifications (member_id, kind, data, body)
  values (p_member, 'payment_recorded', jsonb_build_object('month', p_month, 'amount', p_amount),
          'تم تسجيل انتسابك لشهر ' || public.ar_month_label(p_month) || '، شكرًا لك 🤍');
  return v_id;
end $$;

/** تصحيح دفعة مؤكدة: قيد جديد بالمبلغ الصحيح، والقيد الأصلي يصبح «ملغى» (لا يُحذف) */
create or replace function public.correct_payment(p_id uuid, p_amount integer, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v public.payments; v_id uuid;
begin
  select * into v from public.payments where id = p_id;
  if v.id is null or not public.can_manage_member(v.member_id) then raise exception 'ليست لديك صلاحية'; end if;
  if v.status <> 'confirmed' then raise exception 'لا يُصحَّح إلا قيد مؤكد'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'المبلغ يجب أن يكون أكبر من صفر'; end if;
  update public.payments set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now() where id = p_id;
  insert into public.payments (member_id, month, amount, method, reference, status, source, kind, corrects, note)
  values (v.member_id, v.month, p_amount, v.method, v.reference, 'confirmed', 'admin', 'correction', p_id,
          coalesce(nullif(trim(p_note), ''), 'تصحيح قيد'))
  returning id into v_id;
  return v_id;
end $$;

/** «حذف» دفعة صار إلغاءً: يبقى القيد في السجل بحالة «ملغاة» */
create or replace function public.delete_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_member((select member_id from public.payments where id = p_id)) then raise exception 'ليست لديك صلاحية'; end if;
  update public.payments set status = 'cancelled', cancelled_by = auth.uid(), cancelled_at = now()
   where id = p_id and status in ('pending', 'confirmed');
end $$;

create or replace function public.set_payment_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_member uuid; v_month text;
begin
  if p_status not in ('pending', 'confirmed', 'rejected') then raise exception 'حالة غير صحيحة'; end if;
  select member_id, month into v_member, v_month from public.payments where id = p_id;
  if not public.can_manage_member(v_member) then raise exception 'ليست لديك صلاحية'; end if;
  if p_status <> 'rejected' and exists (
    select 1 from public.payments where member_id = v_member and month = v_month and status in ('pending', 'confirmed') and id <> p_id
  ) then
    raise exception 'هذا الشهر مدفوع من قبل';
  end if;
  update public.payments set status = p_status where id = p_id and status <> 'cancelled';
end $$;

/** حذف منتسب له دفعات ممنوع (الدفعات لا تُحذف)؛ يُوقَف بدلاً من ذلك */
create or replace function public.delete_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if exists (select 1 from public.payments where member_id = p_member) then
    raise exception 'لا يمكن حذف منتسب له دفعات مسجلة؛ أوقفه بدلاً من ذلك';
  end if;
  delete from public.members where id = p_member;
end $$;

-- ---------- 7) أعضاء اللجنة ----------
/** تعيين دور في اللجنة لمنتسب له حساب، أو إزالته (p_role = null). للجنة فقط */
create or replace function public.set_committee_role(p_member uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  select user_id into v_user from public.members where id = p_member and status = 'approved';
  if v_user is null then raise exception 'المنتسب غير معتمد أو ليس له حساب دخول'; end if;
  if p_role is null then
    if (select count(*) from public.admins) <= 1 and exists (select 1 from public.admins where user_id = v_user) then
      raise exception 'لا يمكن إزالة آخر عضو في اللجنة';
    end if;
    delete from public.admins where user_id = v_user;
  else
    if p_role not in ('president', 'membership', 'finance', 'committee') then raise exception 'دور غير صحيح'; end if;
    insert into public.admins (user_id, role) values (v_user, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end $$;

-- ---------- 8) دوال البوت ----------
/** من أنا؟ الدور يُقرأ من قاعدة البيانات فقط. لا يعيد إلا بيانات صاحب الطلب */
create or replace function public.bot_whoami() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'role', case when auth.uid() is null then 'guest'
                 when public.is_admin() then 'committee'
                 when public.is_supervisor() then 'supervisor'
                 when m.id is not null then 'member'
                 else 'guest' end,
    'committee_role', (select a.role from public.admins a where a.user_id = auth.uid()),
    'member_id', m.id, 'code', m.code, 'name', m.full_name, 'member_status', m.status,
    'lists', coalesce((select json_agg(json_build_object('id', l.id, 'name', l.name) order by l.name)
                         from public.lists l where l.supervisor_user_id = auth.uid()), '[]'::json),
    'unread', (select count(*) from public.notifications n where n.member_id = m.id and n.read_at is null)
  )
  from (select 1) x left join public.members m on m.user_id = auth.uid()
$$;

/**
 * البحث عن منتسب بالمعرّف (AWN-0123 / M-0123 / 0123) أو بالاسم (دون مراعاة الهمزات والتشكيل).
 * للجنة والمشرفين فقط؛ المشرف لا يجد إلا منتسبي قائمته. RLS تطبَّق أيضاً (security invoker).
 */
create or replace function public.bot_find_members(p_query text, p_month text default null)
returns table (id uuid, code text, full_name text, list_name text, phone_last3 text, status text, pledge integer, month_total integer, month_count integer)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
declare
  q text := public.normalize_ar(p_query);
  v_month text := coalesce(p_month, public.current_month());
  v_num integer;
begin
  if not public.is_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_query ~* '^\s*(awn|m)?\s*[-_#]?\s*[0-9]{1,6}\s*$' then
    v_num := regexp_replace(p_query, '[^0-9]', '', 'g')::integer;
  end if;
  if v_num is null and char_length(q) < 2 then return; end if;
  return query
    select m.id, m.code, m.full_name, l.name, right(m.phone, 3), m.status, m.pledge,
           coalesce((select sum(p.amount) from public.payments p where p.member_id = m.id and p.month = v_month and p.status = 'confirmed'), 0)::int,
           (select count(*) from public.payments p where p.member_id = m.id and p.month = v_month and p.status = 'confirmed')::int
      from public.members m left join public.lists l on l.id = m.list_id
     where m.status in ('approved', 'suspended')
       and (public.is_admin() or m.list_id in (select public.my_list_ids()))
       and (case when v_num is not null
                 then nullif(regexp_replace(m.code, '[^0-9]', '', 'g'), '')::integer = v_num
                 else (select bool_and(public.normalize_ar(m.full_name) like '%' || w || '%') from unnest(string_to_array(q, ' ')) w)
            end)
     order by (public.normalize_ar(m.full_name) = q) desc, m.full_name
     limit 10;
end $$;

/** بطاقة منتسب وسجل دفعاته — لمن يحق له إدارته فقط */
create or replace function public.bot_member_card(p_member uuid) returns json
language plpgsql stable security invoker set search_path = public as $$
declare v json;
begin
  if not public.is_staff() or not public.can_manage_member(p_member) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select json_build_object(
    'id', m.id, 'code', m.code, 'name', m.full_name, 'phone', m.phone, 'status', m.status, 'pledge', m.pledge,
    'occupation', m.occupation, 'institution', m.institution, 'address', m.address, 'list', l.name, 'supervisor', l.supervisor_name,
    'approved_at', m.approved_at, 'created_at', m.created_at, 'late_months', public.unpaid_streak(m.id),
    'payments', coalesce((select json_agg(json_build_object('month', p.month, 'amount', p.amount, 'status', p.status, 'kind', p.kind,
                                                             'method', p.method, 'note', p.note, 'created_at', p.created_at)
                                          order by p.month desc, p.created_at desc)
                            from (select * from public.payments where member_id = m.id order by month desc, created_at desc limit 24) p), '[]'::json)
  ) into v
  from public.members m left join public.lists l on l.id = m.list_id where m.id = p_member;
  return v;
end $$;

/** من لم يُسجَّل له انتساب في الشهر (لا مؤكد ولا منتظر) — المشرف قائمته، واللجنة الكل */
create or replace function public.bot_unpaid(p_month text default null)
returns table (list_name text, code text, full_name text, phone_last3 text, pledge integer)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
declare v_month text := coalesce(p_month, public.current_month());
begin
  if not public.is_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select coalesce(l.name, 'بدون قائمة'), m.code, m.full_name, right(m.phone, 3), m.pledge
      from public.members m left join public.lists l on l.id = m.list_id
     where m.status = 'approved'
       and (public.is_admin() or m.list_id in (select public.my_list_ids()))
       and to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') <= v_month
       and not exists (select 1 from public.payments p where p.member_id = m.id and p.month = v_month and p.status in ('pending', 'confirmed'))
     order by 1, m.full_name;
end $$;

/** المتأخرون: عدد الأشهر المتتالية غير المدفوعة ≥ p_min */
create or replace function public.bot_late(p_min integer default 2)
returns table (list_name text, code text, full_name text, phone_last3 text, months integer)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select * from (
      select coalesce(l.name, 'بدون قائمة') as list_name, m.code, m.full_name, right(m.phone, 3), public.unpaid_streak(m.id) as months
        from public.members m left join public.lists l on l.id = m.list_id
       where m.status = 'approved' and (public.is_admin() or m.list_id in (select public.my_list_ids()))
    ) t
    where t.months >= greatest(coalesce(p_min, 2), 1)
    order by t.months desc, t.list_name, t.full_name;
end $$;

/** ملخص الشهر: الدافعون ونسبتهم، والمجموع، والمقارنة بالشهر الماضي، والتحصيل لكل قائمة */
create or replace function public.bot_month_summary(p_month text default null) returns json
language plpgsql stable security invoker set search_path = public as $$
declare
  v_month text := coalesce(p_month, public.current_month());
  v_prev text := to_char(to_date(v_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM');
  v json;
begin
  if not public.is_staff() then raise exception 'not_allowed' using errcode = '42501'; end if;
  with scope as (
    select m.id, m.list_id, to_char(coalesce(m.approved_at, m.created_at), 'YYYY-MM') as start
      from public.members m
     where m.status = 'approved' and (public.is_admin() or m.list_id in (select public.my_list_ids()))
  ),
  stat as (
    select mon,
           (select count(*) from scope s where s.start <= mon) as members,
           (select count(distinct p.member_id) from public.payments p join scope s on s.id = p.member_id
             where p.month = mon and p.status = 'confirmed') as payers,
           (select coalesce(sum(p.amount), 0) from public.payments p join scope s on s.id = p.member_id
             where p.month = mon and p.status = 'confirmed') as total
      from unnest(array[v_month, v_prev]) mon
  )
  select json_build_object(
    'month', v_month, 'prev_month', v_prev,
    'current', (select row_to_json(stat) from stat where mon = v_month),
    'previous', (select row_to_json(stat) from stat where mon = v_prev),
    'lists', coalesce((
      select json_agg(x order by x.name) from (
        select coalesce(l.name, 'بدون قائمة') as name, count(s.id) as members,
               count(distinct p.member_id) as payers, coalesce(sum(p.amount), 0) as total
          from scope s
          left join public.lists l on l.id = s.list_id
          left join public.payments p on p.member_id = s.id and p.month = v_month and p.status = 'confirmed'
         where s.start <= v_month
         group by l.name
      ) x), '[]'::json)
  ) into v;
  return v;
end $$;

/** «حالتي»: المنتسب يرى انتسابه هو فقط */
create or replace function public.my_membership() returns json
language plpgsql stable security invoker set search_path = public as $$
declare v_member uuid := public.my_member_id(); v json;
begin
  if v_member is null then raise exception 'no_member' using errcode = '42501'; end if;
  select json_build_object(
    'code', m.code, 'name', m.full_name, 'status', m.status, 'pledge', m.pledge, 'list', l.name,
    'late_months', public.unpaid_streak(m.id),
    'current_month', public.current_month(),
    'paid_this_month', (select coalesce(sum(p.amount), 0) from public.payments p where p.member_id = m.id and p.month = public.current_month() and p.status = 'confirmed'),
    'pending_this_month', exists (select 1 from public.payments p where p.member_id = m.id and p.month = public.current_month() and p.status = 'pending'),
    'payments', coalesce((select json_agg(json_build_object('month', p.month, 'amount', p.amount, 'status', p.status, 'kind', p.kind)
                                          order by p.month desc, p.created_at desc)
                            from (select * from public.payments where member_id = m.id order by month desc, created_at desc limit 12) p), '[]'::json),
    'notifications', coalesce((select json_agg(json_build_object('body', n.body, 'data', n.data, 'created_at', n.created_at, 'read', n.read_at is not null)
                                               order by n.created_at desc)
                                 from (select * from public.notifications where member_id = m.id order by created_at desc limit 5) n), '[]'::json)
  ) into v
  from public.members m left join public.lists l on l.id = m.list_id where m.id = v_member;
  return v;
end $$;

-- ---------- 9) الصلاحيات على الدوال (كما في الترحيل الأول) ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.campaign_totals() to anon;
