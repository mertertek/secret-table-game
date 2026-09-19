-- Secret Table — tetikleyici fonksiyon EXECUTE temizliği (C06).
--
-- `game_states_notify` bir SECURITY DEFINER tetikleyici fonksiyonudur (0003).
-- Postgres varsayılanı EXECUTE'u PUBLIC'e verir; `anon`/`authenticated` bunu
-- miras alır. Tetikleyici fonksiyonu doğrudan çağrılamasa da (trigger context
-- dışında hata verir), "otomatik izinlere güvenme" ilkesi gereği açıkça geri alınır.

revoke all on function public.game_states_notify() from public, anon, authenticated;
grant execute on function public.game_states_notify() to service_role;

notify pgrst, 'reload schema';
