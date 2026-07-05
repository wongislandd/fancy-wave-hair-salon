alter table public.gallery_photos
add column if not exists alt_text_en text,
add column if not exists alt_text_zh text;

update public.gallery_photos
set
  alt_text_en = coalesce(nullif(trim(alt_text_en), ''), alt_text),
  alt_text_zh = coalesce(nullif(trim(alt_text_zh), ''), nullif(trim(alt_text_en), ''), alt_text);

alter table public.gallery_photos
alter column alt_text_en set not null,
alter column alt_text_zh set not null;

alter table public.gallery_photos
drop constraint if exists gallery_photos_alt_text_check;

alter table public.gallery_photos
add constraint gallery_photos_alt_text_check check (length(trim(alt_text)) >= 2),
add constraint gallery_photos_alt_text_en_check check (length(trim(alt_text_en)) >= 2),
add constraint gallery_photos_alt_text_zh_check check (length(trim(alt_text_zh)) >= 2);
