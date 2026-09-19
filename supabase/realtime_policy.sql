-- Özel oda Realtime kanalı yetkisi — DASHBOARD YEDEĞİ.
--
-- Normalde `supabase/migrations/0004_explicit_grants.sql` bunu uygular. Eğer
-- `supabase db push` çıktısında "room_channel_read politikasi atlandi (yetki yok)"
-- notice'i görürsen, aşağıdaki bloğu Supabase Dashboard → SQL Editor'de çalıştır.
-- (0004 migration'ı `public.is_room_member` fonksiyonunu zaten oluşturur.)

alter table realtime.messages enable row level security;

drop policy if exists room_channel_read on realtime.messages;

create policy room_channel_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
      when realtime.topic() ~ '^room:[0-9a-fA-F-]{36}$'
        then public.is_room_member(substring(realtime.topic() from 6)::uuid)
      else false
    end
  );

-- İstemciye Broadcast GÖNDERME (insert) yetkisi verilmez.
