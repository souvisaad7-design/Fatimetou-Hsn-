-- =========================================================
-- نظام اللجنة الانتسابية — جمعية عون وسند الخيرية
-- الجداول + الصلاحيات (RLS). القراءة عبر RLS، وكل تعديل عبر دوال آمنة (security definer)
-- تتحقق من دور صاحب الطلب: منتسب، مشرف قائمة، أو مسؤول في اللجنة.
-- =========================================================

create sequence if not exists public.member_code_seq;

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  supervisor_name text not null check (char_length(supervisor_name) between 1 and 120),
  supervisor_phone text check (supervisor_phone is null or supervisor_phone ~ '^[234][0-9]{7}$'),
  supervisor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  code text not null unique default ('AWN-' || lpad(nextval('public.member_code_seq')::text, 4, '0')),
  full_name text not null check (char_length(full_name) between 3 and 120),
  phone text not null check (phone ~ '^[234][0-9]{7}$'),
  nni text check (nni is null or nni ~ '^[0-9]{10}$'),
  gender text not null check (gender in ('ذكر', 'أنثى')),
  birth_date date,
  occupation text not null check (char_length(occupation) <= 60),
  institution text check (char_length(institution) <= 120),
  address text check (char_length(address) <= 120),
  list_id uuid references public.lists(id) on delete set null,
  pledge integer check (pledge is null or pledge > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
-- رقم الهاتف لا يتكرر إلا لطلب مرفوض
create unique index members_phone_active_idx on public.members (phone) where status <> 'rejected';
create index members_list_idx on public.members (list_id);
create index members_status_idx on public.members (status);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  amount integer not null check (amount > 0),
  method text not null check (char_length(method) <= 40),
  reference text check (char_length(reference) <= 80),
  receipt text check (receipt is null or (receipt like 'data:image/%' and length(receipt) < 400000)),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  source text not null check (source in ('member', 'admin')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index payments_member_idx on public.payments (member_id, month);
create index payments_status_idx on public.payments (status);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  goal integer not null default 0 check (goal >= 0),
  start_date date not null default current_date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  donor_name text not null default 'فاعل خير' check (char_length(donor_name) <= 120),
  donor_phone text check (donor_phone is null or donor_phone ~ '^[234][0-9]{7}$'),
  amount integer not null check (amount > 0),
  method text not null check (char_length(method) <= 40),
  reference text check (char_length(reference) <= 80),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now()
);
create index donations_campaign_idx on public.donations (campaign_id, status);
create index donations_member_idx on public.donations (member_id);

-- ============== دوال الأدوار ==============
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

create or replace function public.is_supervisor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lists where supervisor_user_id = auth.uid())
$$;

create or replace function public.my_list_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.lists where supervisor_user_id = auth.uid()
$$;

create or replace function public.my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;

/** هل يستطيع المستخدم الحالي إدارة هذا المنتسب؟ (المسؤول، أو مشرف قائمته) */
create or replace function public.can_manage_member(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.members m join public.lists l on l.id = m.list_id
    where m.id = p_member and l.supervisor_user_id = auth.uid()
  )
$$;

-- ============== RLS: القراءة ==============
alter table public.lists enable row level security;
alter table public.members enable row level security;
alter table public.admins enable row level security;
alter table public.payments enable row level security;
alter table public.campaigns enable row level security;
alter table public.donations enable row level security;

create policy lists_read on public.lists for select to authenticated using (true);

create policy members_read on public.members for select to authenticated using (
  user_id = auth.uid()
  or public.is_admin()
  or list_id in (select public.my_list_ids())
  or (status = 'pending' and public.is_supervisor())
);

create policy admins_read on public.admins for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy payments_read on public.payments for select to authenticated using (
  member_id = public.my_member_id() or public.can_manage_member(member_id)
);

create policy campaigns_read on public.campaigns for select to anon, authenticated using (true);

create policy donations_read on public.donations for select to authenticated using (
  public.is_admin() or member_id = public.my_member_id()
);

-- لا كتابة مباشرة على الجداول: كل التعديلات عبر الدوال أدناه
revoke insert, update, delete on public.lists, public.members, public.admins, public.payments, public.campaigns, public.donations from anon, authenticated;

-- ============== دوال الملف الشخصي والأدوار ==============
create or replace function public.my_profile() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'member_id', public.my_member_id(),
    'is_admin', public.is_admin(),
    'list_ids', coalesce((select json_agg(id) from public.my_list_ids() id), '[]'::json),
    'admins_exist', exists (select 1 from public.admins)
  )
$$;

/** أول مستخدم يطلب ذلك يصبح المسؤول الأول (فقط إذا لم يوجد أي مسؤول بعد) */
create or replace function public.claim_first_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  perform pg_advisory_xact_lock(42);
  if exists (select 1 from public.admins) then return false; end if;
  insert into public.admins (user_id) values (auth.uid());
  return true;
end $$;

-- ============== المنتسبون ==============
create or replace function public.approve_member(p_member uuid, p_list uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_list uuid := p_list;
begin
  if public.is_admin() then
    null;
  elsif public.is_supervisor() then
    -- المشرف يقبل الطلبات الجديدة في قائمته فقط
    if not exists (select 1 from public.members where id = p_member and status = 'pending') then
      raise exception 'لا يمكنك قبول هذا الطلب';
    end if;
    if v_list is null or v_list not in (select public.my_list_ids()) then
      select id into v_list from public.my_list_ids() id limit 1;
    end if;
  else
    raise exception 'ليست لديك صلاحية';
  end if;
  update public.members
     set status = 'approved', list_id = coalesce(v_list, list_id), approved_at = coalesce(approved_at, now())
   where id = p_member;
end $$;

create or replace function public.set_member_status(p_member uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('pending', 'approved', 'rejected', 'suspended') then raise exception 'حالة غير صحيحة'; end if;
  if not (
    public.is_admin()
    or (p_status = 'rejected' and public.is_supervisor() and exists (select 1 from public.members where id = p_member and status = 'pending'))
  ) then raise exception 'ليست لديك صلاحية'; end if;
  update public.members
     set status = p_status, approved_at = case when p_status = 'approved' then coalesce(approved_at, now()) else approved_at end
   where id = p_member;
end $$;

/** المسؤول يضيف منتسباً يدوياً (بلا حساب دخول) أو يعدّل بياناته */
create or replace function public.admin_save_member(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if v_id is null then
    insert into public.members (full_name, phone, nni, gender, birth_date, occupation, institution, address, list_id, pledge, notes, status, approved_at)
    values (p->>'full_name', p->>'phone', nullif(p->>'nni', ''), p->>'gender', nullif(p->>'birth_date', '')::date, p->>'occupation',
            nullif(p->>'institution', ''), nullif(p->>'address', ''), nullif(p->>'list_id', '')::uuid, nullif(p->>'pledge', '')::int,
            nullif(p->>'notes', ''), 'approved', now())
    returning id into v_id;
  else
    update public.members set
      full_name = p->>'full_name', phone = p->>'phone', nni = nullif(p->>'nni', ''), gender = p->>'gender',
      birth_date = nullif(p->>'birth_date', '')::date, occupation = p->>'occupation', institution = nullif(p->>'institution', ''),
      address = nullif(p->>'address', ''), list_id = nullif(p->>'list_id', '')::uuid, pledge = nullif(p->>'pledge', '')::int,
      notes = nullif(p->>'notes', '')
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.delete_member(p_member uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.members where id = p_member;
end $$;

create or replace function public.update_my_pledge(p_pledge integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pledge is not null and p_pledge <= 0 then raise exception 'مبلغ غير صحيح'; end if;
  update public.members set pledge = p_pledge where user_id = auth.uid();
end $$;

-- ============== القوائم ==============
create or replace function public.save_list(p_id uuid, p_name text, p_supervisor_member uuid, p_supervisor_name text, p_supervisor_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid := p_id; v_user uuid; v_name text := p_supervisor_name; v_phone text := nullif(p_supervisor_phone, '');
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if p_supervisor_member is not null then
    select user_id, full_name, phone into v_user, v_name, v_phone from public.members where id = p_supervisor_member;
  end if;
  if v_id is null then
    insert into public.lists (name, supervisor_name, supervisor_phone, supervisor_user_id)
    values (p_name, v_name, v_phone, v_user) returning id into v_id;
  else
    update public.lists set name = p_name, supervisor_name = v_name, supervisor_phone = v_phone, supervisor_user_id = v_user where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.delete_list(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.lists where id = p_id;
end $$;

-- ============== الانتساب الشهري ==============
/** المنتسب يبلغ عن دفعة (بانتظار التأكيد)، مع صورة الإيصال اختيارياً */
create or replace function public.report_payment(p_month text, p_amount integer, p_method text, p_reference text, p_receipt text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_member uuid := public.my_member_id(); v_id uuid;
begin
  if v_member is null or not exists (select 1 from public.members where id = v_member and status in ('approved', 'suspended')) then
    raise exception 'حسابك غير معتمد بعد';
  end if;
  if exists (select 1 from public.payments where member_id = v_member and month = p_month and status = 'confirmed') then
    raise exception 'هذا الشهر مدفوع من قبل';
  end if;
  insert into public.payments (member_id, month, amount, method, reference, receipt, status, source)
  values (v_member, p_month, p_amount, p_method, nullif(p_reference, ''), nullif(p_receipt, ''), 'pending', 'member')
  returning id into v_id;
  return v_id;
end $$;

/** المشرف أو المسؤول يسجّل دفعة مستلمة (مؤكدة) */
create or replace function public.record_payment(p_member uuid, p_month text, p_amount integer, p_method text, p_reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.can_manage_member(p_member) then raise exception 'ليست لديك صلاحية'; end if;
  insert into public.payments (member_id, month, amount, method, reference, status, source)
  values (p_member, p_month, p_amount, p_method, nullif(p_reference, ''), 'confirmed', 'admin')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_payment_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('pending', 'confirmed', 'rejected') then raise exception 'حالة غير صحيحة'; end if;
  if not public.can_manage_member((select member_id from public.payments where id = p_id)) then raise exception 'ليست لديك صلاحية'; end if;
  update public.payments set status = p_status where id = p_id;
end $$;

create or replace function public.delete_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_member((select member_id from public.payments where id = p_id)) then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.payments where id = p_id;
end $$;

-- ============== الحملات والتبرعات ==============
create or replace function public.save_campaign(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if v_id is null then
    insert into public.campaigns (title, description, goal, start_date, end_date, active)
    values (p->>'title', coalesce(p->>'description', ''), coalesce((p->>'goal')::int, 0), coalesce(nullif(p->>'start_date', '')::date, current_date),
            nullif(p->>'end_date', '')::date, coalesce((p->>'active')::boolean, true))
    returning id into v_id;
  else
    update public.campaigns set title = p->>'title', description = coalesce(p->>'description', ''), goal = coalesce((p->>'goal')::int, 0),
      start_date = coalesce(nullif(p->>'start_date', '')::date, start_date), end_date = nullif(p->>'end_date', '')::date,
      active = coalesce((p->>'active')::boolean, active)
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.delete_campaign(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.campaigns where id = p_id;
end $$;

/** تبرع: من المنتسب (بانتظار التأكيد) أو يسجّله المسؤول (مؤكد) */
create or replace function public.add_donation(p_campaign uuid, p_donor_name text, p_donor_phone text, p_amount integer, p_method text, p_reference text, p_member uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_admin boolean := public.is_admin(); v_member uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول'; end if;
  if not exists (select 1 from public.campaigns where id = p_campaign and (active or v_admin)) then raise exception 'الحملة غير متاحة'; end if;
  v_member := case when v_admin then p_member else public.my_member_id() end;
  insert into public.donations (campaign_id, member_id, donor_name, donor_phone, amount, method, reference, status)
  values (p_campaign, v_member, coalesce(nullif(trim(p_donor_name), ''), 'فاعل خير'), nullif(p_donor_phone, ''), p_amount, p_method,
          nullif(p_reference, ''), case when v_admin then 'confirmed' else 'pending' end)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.set_donation_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  if p_status not in ('pending', 'confirmed', 'rejected') then raise exception 'حالة غير صحيحة'; end if;
  update public.donations set status = p_status where id = p_id;
end $$;

create or replace function public.delete_donation(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ليست لديك صلاحية'; end if;
  delete from public.donations where id = p_id;
end $$;

/** مجموع التبرعات المؤكدة لكل حملة (يراه الجميع دون كشف أسماء المتبرعين) */
create or replace function public.campaign_totals() returns table (campaign_id uuid, raised bigint, donors integer)
language sql stable security definer set search_path = public as $$
  select campaign_id, sum(amount)::bigint, count(*)::int from public.donations where status = 'confirmed' group by campaign_id
$$;

-- ============== الصلاحيات على الدوال ==============
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.campaign_totals() to anon;

-- عمود خفيف يبيّن وجود إيصال، حتى لا تُحمَّل صور الإيصالات مع كل قائمة دفعات
alter table public.payments add column has_receipt boolean generated always as (receipt is not null) stored;
