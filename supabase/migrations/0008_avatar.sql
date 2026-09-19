-- D3.4 / B3 — oyuncu karakter seçimi (additive).
--
-- Mevcut hiçbir sütun/politika değişmez; yalnız iki nullable sütun eklenir.
-- NULL = oyuncu henüz seçim yapmadı → sunucu koltuk sırasından türetilen
-- varsayılanı (`avatarForSeat`) projeksiyona koyar. Avatar ROL İMA ETMEZ ve
-- gizli veri değildir; lobide ve masada herkese açıktır.
--
-- Kimlik listesi tasarım kaynağındadır (`docs/design/d3/characters.json`) ve
-- `packages/contracts/src/avatars.ts` ile birebir aynıdır. CHECK'i açık liste
-- olarak yazıyoruz: yanlış/eskimiş bir istemci DB'ye çöp kimlik yazamaz.
-- JSON'a karakter eklenirse bu CHECK yeni bir migration ile genişletilir.

alter table public.room_members
  add column if not exists avatar_character text null,
  add column if not exists avatar_skin text null;

-- `not valid` kullanılmaz: tablo yeni sütunlarda tamamen NULL olduğu için
-- doğrulama anında geçer.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_members'::regclass and conname = 'room_members_avatar_character_chk'
  ) then
    alter table public.room_members
      add constraint room_members_avatar_character_chk
      check (avatar_character is null or avatar_character in (
        'biyikli-amca', 'gozluklu', 'topuzlu', 'fotr',
        'sakalli', 'kivircik', 'bereli-teyze', 'kepli-cocuk'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.room_members'::regclass and conname = 'room_members_avatar_skin_chk'
  ) then
    alter table public.room_members
      add constraint room_members_avatar_skin_chk
      check (avatar_skin is null or avatar_skin in ('acik', 'orta', 'koyu'));
  end if;
end $$;

comment on column public.room_members.avatar_character is
  'D3.4 karakter kimliği (docs/design/d3/characters.json). NULL = seçilmedi; sunucu koltuk varsayılanını verir.';
comment on column public.room_members.avatar_skin is
  'D3.4 ten tonu kimliği (acik/orta/koyu). NULL = seçilmedi.';

-- ---------------------------------------------------------------------------
-- Yetki kalıbı 0001/0004 ile AYNI: room_members'a istemci rollerinin hiçbir
-- doğrudan erişimi yoktur; yazma yalnız sunucunun secret key'i (service_role)
-- üzerinden HTTP API'den gelir. Sütun bazlı grant kullanılmadığı için tablo
-- grant'ları yeni sütunları da kapsar; yine de açıkça tekrar ediyoruz
-- (kullanıcı talebi: otomatik izinlere güvenme).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.room_members to service_role;
revoke all on public.room_members from anon, authenticated;

-- RLS zaten 0001'de açık; yeni sütun yeni politika gerektirmez (tablo düzeyinde
-- istemci politikası yok, 0004 mevcut select politikalarını kaldırmıştı).

notify pgrst, 'reload schema';
