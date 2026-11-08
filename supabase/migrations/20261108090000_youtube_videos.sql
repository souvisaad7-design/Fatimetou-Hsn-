-- =========================================================
-- فيديوهات قناة جمعية عون وسند على يوتيوب (@associationaidesoutien)
-- تُملأ عبر /api/youtube/sync، ويبحث فيها المساعد عبر /api/youtube/search
-- =========================================================

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent ليست immutable، ونحتاج نسخة immutable لاستعمالها في عمود محسوب وفهرس
create or replace function public.immutable_unaccent(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = public, extensions, pg_catalog
as $$
  select unaccent('unaccent'::regdictionary, input)
$$;

-- توحيد النص للبحث بالعربية والفرنسية:
-- إزالة التشكيل والتطويل، أ/إ/آ/ٱ ← ا، ة ← ه، ى ← ي، ؤ ← و، ئ ← ي،
-- إزالة الحركات اللاتينية (é ← e)، أحرف صغيرة، وتوحيد المسافات
create or replace function public.normalize_search_text(input text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  select trim(regexp_replace(
    lower(public.immutable_unaccent(
      translate(
        regexp_replace(coalesce(input, ''), '[ً-ٰٟـ]', '', 'g'),
        'أإآٱةىؤئ',
        'ااااهيوي'
      )
    )),
    '[^[:alnum:]ء-ي٠-٩ٱ-ۓ]+', ' ', 'g'
  ))
$$;

-- تبسيط خفيف للكلمات العربية حتى تتطابق المفردات مع جموعها وأدوات التعريف:
-- الحملة / حملات ← حمل ، السقاية / سقايات ← سقاي
create or replace function public.arabic_light_stem(input text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_catalog
as $$
  select coalesce(string_agg(
    case
      when w ~ '^[ء-ي]+$' then
        regexp_replace(
          regexp_replace(w, '^(وال|بال|فال|كال|لل|ال)(?=[ء-ي]{3,})', ''),
          '^([ء-ي]{3,}?)(ات|ون|ين|ه)$', '\1'
        )
      else w
    end, ' '), '')
  from unnest(string_to_array(coalesce(input, ''), ' ')) as w
  where w <> ''
$$;

-- كلمات شائعة لا تميّز فيديو عن آخر (تُستبعد من البحث)
create or replace function public.search_stopwords()
returns text[]
language sql
immutable
parallel safe
as $$
  select array[
    'جمعيه','الجمعيه','عون','وسند','سند','خيريه','الخيريه','جمعيتكم',
    'كيف','ماذا','متي','اين','هل','هي','هو','من','في','على','علي','عن','الي','الى','ان','التي','الذي',
    'يمكنني','اريد','لكم','لنا','هذا','هذه','ذلك','كان','عند','مع','او','ثم','ما','لماذا','كم','اي',
    'شي','شنهو','شنهي','عندكم','فيديو','فيديوهات','مقطع','اعرض','عرض','شاهد',
    'association','aide','soutien','les','des','une','pour','dans','avec','est','video'
  ]::text[]
$$;

create table if not exists public.youtube_videos (
  video_id      text primary key,
  title         text not null,
  description   text not null default '',
  thumbnail_url text,
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  -- نص موحّد للبحث (عنوان + وصف)
  search_text   text generated always as (
    public.normalize_search_text(title || ' ' || coalesce(description, ''))
  ) stored,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', public.arabic_light_stem(public.normalize_search_text(title))), 'A') ||
    setweight(to_tsvector('simple', public.arabic_light_stem(public.normalize_search_text(coalesce(description, '')))), 'B')
  ) stored
);

comment on table public.youtube_videos is 'فيديوهات قناة الجمعية على يوتيوب، تُحدَّث يومياً من YouTube Data API';

-- فهرس البحث النصي الكامل، وفهرس التشابه للكلمات الجزئية
create index if not exists youtube_videos_search_vector_idx on public.youtube_videos using gin (search_vector);
create index if not exists youtube_videos_search_trgm_idx on public.youtube_videos using gin (search_text gin_trgm_ops);
create index if not exists youtube_videos_published_idx on public.youtube_videos (published_at desc);

-- RLS: القراءة للجميع، والكتابة للخادم فقط (service role يتجاوز RLS، ولا توجد سياسة كتابة لغيره)
alter table public.youtube_videos enable row level security;

drop policy if exists "youtube_videos_public_read" on public.youtube_videos;
create policy "youtube_videos_public_read"
  on public.youtube_videos
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.youtube_videos from anon, authenticated;

-- البحث: أفضل النتائج حسب تطابق الكلمات (العنوان أهم من الوصف) ثم التشابه الجزئي
create or replace function public.search_youtube_videos(q text, max_results int default 3)
returns table (
  video_id      text,
  title         text,
  thumbnail_url text,
  published_at  timestamptz,
  score         real
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with input as (
    select public.normalize_search_text(q) as nq
  ),
  terms as (
    -- كلمات السؤال المميِّزة: بعد التوحيد، دون الكلمات الشائعة والقصيرة، ثم التبسيط
    select array_agg(distinct public.arabic_light_stem(w)) as words
    from input, unnest(string_to_array(nq, ' ')) as w
    where char_length(w) >= 3
      and w <> all(public.search_stopwords())
      and char_length(public.arabic_light_stem(w)) >= 2
  ),
  query as (
    select
      array_to_string(terms.words, ' ') as nq,
      case when terms.words is null then null
           else to_tsquery('simple', array_to_string(
                  array(select quote_literal(w) || ':*' from unnest(terms.words) as w), ' | '))
      end as tsq
    from input, terms
  )
  select
    v.video_id,
    v.title,
    v.thumbnail_url,
    v.published_at,
    (coalesce(ts_rank(v.search_vector, query.tsq), 0) * 2
      + word_similarity(query.nq, v.search_text))::real as score
  from public.youtube_videos v, query
  where coalesce(query.nq, '') <> ''
    and (
      (query.tsq is not null and v.search_vector @@ query.tsq)
      or (char_length(query.nq) >= 4 and word_similarity(query.nq, v.search_text) > 0.6)
    )
  order by score desc, v.published_at desc nulls last
  limit least(greatest(coalesce(max_results, 3), 1), 3);
$$;

grant execute on function public.search_youtube_videos(text, int) to anon, authenticated;
