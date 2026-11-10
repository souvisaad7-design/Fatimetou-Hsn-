-- وصل الدفع / التحويل البنكي المرفق مع طلب الانتساب (صورة data URL مضغوطة)
alter table public.members
  add column if not exists receipt text
    check (receipt is null or (receipt like 'data:image/%' and length(receipt) < 400000)),
  add column if not exists has_receipt boolean generated always as (receipt is not null) stored;
