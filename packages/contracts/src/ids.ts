/**
 * Opak kimlikler. Hepsi sunucu tarafından üretilir; istemci bunları üretmez,
 * yorumlamaz ve gizli rol / kart türü kodladıklarını varsaymaz.
 *
 * Sözleşme 0.2.0: bkz. docs/CONTRACT.md bölüm 2.
 * İlk sürümde düz `string` takma adları kullanılır; ileride marka (branded) tipe
 * geçmek kırıcı değişiklik sayılmaz çünkü değerler yine opak kalır.
 */

/** Sunucunun oda kimliği. Davet kodu ile eşlenebilir; kimlik doğrulama sırrı değildir. */
export type RoomId = string;

/** Her yeni oyunda üretilen kimlik. Lobide `null` olabilir (bkz. SceneView.gameId). */
export type GameId = string;

/** Oda yaşamı boyunca monoton artan görünüm sürümü. */
export type Revision = number;

/** Mevcut etkileşim penceresinin benzersiz kimliği. Aşama adı tekrarlansa da kimlik tekrar kullanılmaz. */
export type PhaseId = string;

/** Koltuğa bağlı sunucu oyuncu kimliği; bağlantı oturumu kimliğinden bağımsız. */
export type PlayerId = string;

/** Yalnızca geçerli aksiyon penceresinde kullanılabilen opak aksiyon kimliği. */
export type ActionId = string;

/** Bir aksiyon seçeneğinin opak kimliği; yalnızca ilgili aksiyon penceresinde geçerli. */
export type OptionId = string;

/** Bir el/deste kartının opak kimliği. Kart türünü kodlamaz. */
export type CardId = string;

/** Görsel olayın tekrar oynatılmasını engelleyen benzersiz kimlik. */
export type CueId = string;

/** Bir hamlenin tekrar işlenmesini engelleyen benzersiz kimlik. */
export type CommandId = string;

/** Açıklanmış bir seçimin (election) kimliği; devam eden seçim için kullanılmaz. */
export type ElectionId = string;

/**
 * Ağ uyumluluğu için sayı. İlk uygulama `1`.
 * docs/CONTRACT.md 0.2.0 revizyonundan farklı bir kavramdır.
 */
export type ProtocolVersion = 1;
