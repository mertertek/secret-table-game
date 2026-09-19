/**
 * D23 — Türkçe KAYNAK sözlük. Projedeki bütün görünen metin buradadır ve
 * hiçbir satır silinmez; `en.ts` bu anahtar kümesini birebir uygular.
 *
 * Anahtar düzeni: `alan.konu` (`phase.voting`, `menu.tab.settings`).
 * Parametreler `{ad}` biçiminde; çoğul/cinsiyet kuralı gerekmiyor.
 */
export const tr = {
  // -------------------------------------------------------------------------
  // Ortak
  // -------------------------------------------------------------------------
  'common.player': 'Oyuncu',
  'common.you': 'sen',
  'common.youParen': '{name} (sen)',
  'common.close': 'Kapat',
  'common.back': 'Geri',
  'common.refresh': 'Yenile',
  'common.retry': 'Tekrar dene',
  'common.home': 'Ana sayfa',
  'common.yes': 'Evet',
  'common.no': 'Hayır',

  // Dil anahtarı
  'lang.label': 'Dil',
  'lang.tr': 'TR',
  'lang.en': 'EN',
  'lang.trFull': 'Türkçe',
  'lang.enFull': 'İngilizce',

  // -------------------------------------------------------------------------
  // Bağlantı durumu
  // -------------------------------------------------------------------------
  'connection.reconnecting.label': 'Yeniden bağlanılıyor…',
  'connection.reconnecting.hint': 'Bağlantı geçici koptu; işlemler kısa süre gecikebilir.',
  'connection.disconnected.label': 'Bağlantı kesildi',
  'connection.disconnected.hint':
    'İnternet bağlantını kontrol et. Bağlantı gelince oyun kaldığı yerden devam eder.',
  'connection.connected': 'Bağlı',

  // -------------------------------------------------------------------------
  // Seçenek etiketleri (sözleşme `labelKey`)
  // -------------------------------------------------------------------------
  'option.role.ready': 'Hazırım',
  'option.vote.yes': 'Evet',
  'option.vote.no': 'Hayır',
  'option.policy.liberal': 'Liberal kanun',
  'option.policy.fascist': 'Faşist kanun',
  'option.veto.request': 'Veto iste',
  'option.veto.accept': 'Vetoyu kabul et',
  'option.veto.reject': 'Vetoyu reddet',
  'option.power.peek': 'Deste tepesine bak',
  'option.inspection.ack': 'Gördüm, kapat',

  // -------------------------------------------------------------------------
  // Aksiyon başlıkları
  // -------------------------------------------------------------------------
  'action.ack_role.title': 'Rolünü öğren',
  'action.ack_role.hint': 'Rol zarfını aç ve hazır olduğunu bildir.',
  'action.nominate.title': 'Şansölye adayı seç',
  'action.nominate.hint': 'Uygun bir oyuncuyu aday göster.',
  'action.vote.title': 'Oy ver',
  'action.vote.hint': 'Hükümeti onaylıyor musun?',
  'action.discard_policy.title': 'Bir kanunu at',
  'action.discard_policy.hint': 'Elindeki üç karttan birini çöpe at.',
  'action.enact_policy.title': 'Kanun çıkar',
  'action.enact_policy.hint': 'Elindeki iki karttan birini yürürlüğe koy.',
  'action.request_veto.title': 'Veto',
  'action.request_veto.hint': 'Bu turdaki kanunları veto etmeyi öner.',
  'action.respond_veto.title': 'Veto yanıtı',
  'action.respond_veto.hint': 'Şansölyenin veto önerisini yanıtla.',
  'action.use_power.title': 'Başkanlık yetkisi',
  'action.use_power.hint': 'Yetkiyi kullan.',
  'action.ack_private_result.title': 'Özel sonuç',
  'action.ack_private_result.hint': 'Sonucu gördüğünü bildir.',

  // -------------------------------------------------------------------------
  // Aşama adları
  // -------------------------------------------------------------------------
  'phase.lobby': 'Lobi',
  'phase.role_reveal': 'Rol tanışması',
  'phase.nomination': 'Aday belirleme',
  'phase.voting': 'Oylama',
  'phase.election_result': 'Seçim sonucu',
  'phase.president_discard': 'Başkan kart atıyor',
  'phase.chancellor_choice': 'Şansölye kanun seçiyor',
  'phase.veto_response': 'Veto yanıtı',
  'phase.policy_result': 'Kanun sonucu',
  'phase.executive_action': 'Başkanlık yetkisi',
  'phase.game_over': 'Oyun bitti',

  // -------------------------------------------------------------------------
  // Rol / parti / yetki / sonuç adları
  // -------------------------------------------------------------------------
  'role.liberal': 'Liberal',
  'role.fascist': 'Faşist',
  'role.hitler': 'Hitler',
  'party.liberal': 'Liberal parti',
  'party.fascist': 'Faşist parti',
  'policy.liberal': 'Liberal kanun',
  'policy.fascist': 'Faşist kanun',
  'office.president': 'Başkan',
  'office.chancellor': 'Şansölye',
  'office.presidentCandidate': 'Başkan adayı',
  'office.chancellorCandidate': 'Şansölye adayı',
  'office.host': 'Oda sahibi',

  'power.investigate_loyalty': 'Sadakat incelemesi',
  'power.call_special_election': 'Özel seçim',
  'power.policy_peek': 'Deste tepesine bakma',
  'power.execution': 'İnfaz',

  'end.liberal_policies_enacted': 'Beş liberal kanun çıktı',
  'end.fascist_policies_enacted': 'Altı faşist kanun çıktı',
  'end.hitler_elected_chancellor': 'Hitler şansölye seçildi',
  'end.hitler_executed': 'Hitler infaz edildi',
  'winner.liberal': 'Liberaller kazandı',
  'winner.fascist': 'Faşistler kazandı',

  // -------------------------------------------------------------------------
  // Yetki eylem metni (QA-R03)
  // -------------------------------------------------------------------------
  'powerAction.execution.title': 'İnfaz',
  'powerAction.execution.hint': 'Seçtiğin oyuncu oyundan elenir. Bu işlem geri alınamaz.',
  'powerAction.execution.submit': 'İnfaz et',
  'powerAction.execution.consequence': '{name} infaz edilecek — oyundan elenecek.',
  'powerAction.investigate_loyalty.title': 'Sadakat incelemesi',
  'powerAction.investigate_loyalty.hint':
    'Seçtiğin oyuncunun parti aidiyetini (liberal / faşist) yalnız sen görürsün.',
  'powerAction.investigate_loyalty.submit': 'İncele',
  'powerAction.investigate_loyalty.consequence':
    '{name} oyuncusunun partisi yalnız sana gösterilecek.',
  'powerAction.call_special_election.title': 'Özel seçim',
  'powerAction.call_special_election.hint': 'Seçtiğin oyuncu sıradaki başkan adayı olur.',
  'powerAction.call_special_election.submit': 'Aday yap',
  'powerAction.call_special_election.consequence': '{name} sıradaki başkan adayı olacak.',
  'powerAction.policy_peek.title': 'Deste tepesine bakma',
  'powerAction.policy_peek.hint': 'Destenin en üstteki üç kanununu yalnız sen görürsün.',
  'powerAction.policy_peek.submit': 'Deste tepesine bak',
  'powerAction.policy_peek.consequence': 'Destenin en üstteki üç kanununu göreceksin.',
  'powerAction.default.submit': 'Gönder',
  'powerAction.default.consequence': 'Seçilen: {name}',

  // -------------------------------------------------------------------------
  // Hata metinleri (QA-R04)
  // -------------------------------------------------------------------------
  'error.generic': 'Beklenmeyen bir hata oldu. Sayfayı yenileyip tekrar dene.',
  'error.room_not_found':
    'Oda bulunamadı ya da süresi doldu. Ana sayfadan yeni oda kur veya güncel davet bağlantısını iste.',
  'error.room_full': 'Oda dolu. Oda sahibinden yer açmasını iste ya da yeni bir oda kurun.',
  'error.game_already_started':
    'Oyun çoktan başladı; yeni oyuncu alınmıyor. Oyun bitince tekrar katılabilirsin.',
  'error.session_invalid': 'Oturum geçersiz. Sayfayı yenile; oyun kaldığı yerden gelir.',
  'error.reconnect_expired': 'Geri dönüş süresi doldu. Ana sayfadan tekrar katıl.',
  'error.stale_action': 'Bu adım artık geçerli değil; görünüm yenilendi. Yeni duruma göre tekrar dene.',
  'error.not_allowed': 'Bu işleme şu anda izin yok. Sıranı bekle veya görünüm yenilenince tekrar dene.',
  'error.invalid_option': 'Geçersiz seçim. Listeden geçerli bir seçenek seç.',
  'error.rate_limited': 'Çok hızlı işlem yapıldı. Birkaç saniye bekleyip tekrar dene.',
  'error.version_mismatch': 'Uygulama sürümü güncel değil. Sayfayı yenile.',
  'error.retryable_conflict':
    'Aynı anda başka bir işlem oldu; otomatik tekrar denendi. Sonuç görünmezse bir kez daha dene.',
  'error.service_unavailable':
    'Sunucuya şu an ulaşılamıyor. Birkaç saniye sonra tekrar dene; bağlantın varsa oyun kaybolmaz.',
  'error.MISSING_TOKEN': 'Oturum başlatılamadı. Sayfayı yenile.',
  'error.SUPABASE_NOT_CONFIGURED': 'Sunucu yapılandırması eksik. Oda sahibine / yöneticiye bildir.',
  'error.CLIENT_NOT_CONFIGURED':
    'Uygulama yapılandırması eksik: tarayıcı Supabase ayarları (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY) derlemeye girmemiş. Oda sahibine / yöneticiye bildir.',
  'error.GUEST_LIMIT_REACHED':
    'Bu ön izleme dağıtımı saatlik misafir sınırına ulaştı, şu an yeni oturum açılamıyor. Biraz sonra tekrar dene ya da kendi kopyanı çalıştır: kurulum rehberi depoda (docs/SETUP.md).',
  'error.NETWORK_ERROR': 'Ağ hatası. İnternet bağlantını kontrol edip tekrar dene.',
  'error.REQUEST_FAILED': 'İstek tamamlanamadı. Birkaç saniye sonra tekrar dene.',
  'error.INVALID_COMMAND': 'İstek geçersiz. Sayfayı yenileyip tekrar dene.',
  'error.MISSING_ROOM_ID': 'Oda bilgisi eksik. Sayfayı yenile.',
  'error.MISSING_INVITE_CODE': 'Davet kodu gerekli.',
  'error.MISSING_ACTION': 'İstek eksik görünüyor. Sayfayı yenile.',
  'error.METHOD_NOT_ALLOWED': 'Bu istek türü desteklenmiyor. Sayfayı yenile.',
  'error.UNKNOWN_ACTION': 'Bilinmeyen işlem. Sayfayı yenile.',
  'error.createRoom': 'Oda açılamadı.',
  'error.joinRoom': 'Odaya katılınamadı.',
  'error.unexpected': 'Beklenmeyen bir hata oluştu.',

  // -------------------------------------------------------------------------
  // Üst bilgi şeridi (statusLine)
  // -------------------------------------------------------------------------
  'status.votesOpening': 'Oylar açılıyor',
  'status.waitingFor': 'Bekleyen: {names}',
  'status.tally': 'Evet {yes} · Hayır {no}',
  'status.tallyYes': 'Evet: {names}',
  'status.tallyNo': 'Hayır: {names}',
  'status.governmentFormed': 'Hükümet kuruldu: {president} / {chancellor}',
  'status.governmentRejected': 'Hükümet reddedildi',
  'status.cardsDealt': 'Kartlar dağıtıldı',
  'status.votedAlready': 'Oyunu verdin',
  'status.notVotedYet': 'sen henüz oy vermedin',
  'status.own.ack_role': 'Sıra sende: rolüne bak ve hazır olduğunu bildir',
  'status.own.nominate': 'Sıra sende: şansölye adayını seç',
  'status.own.discard': 'Sıra sende: {count} karttan birini at',
  'status.own.enact': 'Sıra sende: iki karttan birini yürürlüğe koy',
  'status.own.requestVeto': 'Sıra sende: istersen bu kanunları veto etmeyi öner',
  'status.own.respondVeto': 'Sıra sende: veto önerisini yanıtla',
  'status.own.usePower': 'Sıra sende: başkanlık yetkisini kullan',
  'status.own.peek': 'Sıra sende: deste tepesine bak',
  'status.own.powerTarget': 'Sıra sende: {power} için oyuncu seç',
  'status.own.ackPrivate': 'Sıra sende: gördüğün özel bilgiyi onayla',
  'status.own.generic': 'Sıra sende',
  'status.others.lobby': 'Oyuncular bekleniyor',
  'status.others.roleReveal': '{count} oyuncu rolüne bakıyor',
  'status.others.rolesSeen': 'Roller görüldü; oyun başlıyor',
  'status.others.nominating': 'Başkan {name} şansölye adayını seçiyor',
  'status.others.nominationGeneric': 'Şansölye adayı seçiliyor',
  'status.others.electionResult': 'Seçim sonucu açıklanıyor',
  'status.others.presidentDiscard': '{president} 3 karttan birini atıyor',
  'status.others.chancellorChoice': '{chancellor} kanunu seçiyor',
  'status.others.vetoResponse': '{president} veto önerisini yanıtlıyor',
  'status.others.policyResult': 'Kanun tahtaya konuyor',
  'status.others.powerInUse': 'Başkan {name} {power} kullanıyor',
  'status.others.powerGeneric': 'Başkanlık yetkisi kullanılıyor',
  'status.others.generic': 'Diğer oyuncular bekleniyor',
  'status.pausedWaiting': 'Oyun duraklatıldı; bekleniyor: {names}',
  'status.paused': 'Oyun duraklatıldı; oyuncular bekleniyor',

  // -------------------------------------------------------------------------
  // Ekran ortası duyuruları (D9)
  // -------------------------------------------------------------------------
  'ann.rolesDealt.title': 'ROLLER DAĞITILDI',
  'ann.rolesDealt.sub': 'Kimliğine bak: H',
  'ann.nomination.title': 'ADAY SEÇİMİ',
  'ann.nomination.you': 'Şansölye adayını seç',
  'ann.nomination.other': 'Başkan {president} şansölye adayını seçiyor',
  'ann.voting.title': 'OYLAMA',
  'ann.voting.voted': 'Oyunu verdin',
  'ann.voting.sub': '{pair} hükümeti için oy ver',
  'ann.legislative.title': 'YASAMA',
  'ann.legislative.discardYou': 'Bir kart at',
  'ann.legislative.discardOther': 'Başkan {president} 3 karttan birini atıyor',
  'ann.legislative.enactYou': 'Kanunu seç',
  'ann.legislative.enactOther': 'Şansölye {chancellor} kanunu seçiyor',
  'ann.veto.title': 'VETO',
  'ann.veto.you': 'Şansölye veto istedi: yanıtla',
  'ann.veto.other': 'Başkan {president} veto önerisini yanıtlıyor',
  'ann.veto.accepted': 'Veto kabul edildi: kanunlar atıldı',
  'ann.power.title': 'BAŞKANLIK YETKİSİ',
  'ann.power.generic': 'Yetki kullanılıyor',
  'ann.power.peekYou': '{power} · Deste tepesine bak',
  'ann.power.peekOther': '{power} · Başkan {name} desteye bakıyor',
  'ann.power.pickYou': '{power} · Bir oyuncu seç',
  'ann.power.pickOther': '{power} · Başkan {name} oyuncu seçiyor',
  'ann.electionPassed.title': 'HÜKÜMET KURULDU',
  'ann.electionFailed.title': 'HÜKÜMET REDDEDİLDİ',
  'ann.tracker': 'Seçim sayacı {tracker}/{max}',
  'ann.policyFascist.title': 'FAŞİST KANUN',
  'ann.policyLiberal.title': 'LİBERAL KANUN',
  'ann.board': 'Tahta: {liberal} liberal · {fascist} faşist',
  'ann.hitlerZone': 'Hitler artık şansölye seçilirse oyun biter',
  'ann.vetoUnlocked': 'Veto açıldı',
  'ann.execution.title': 'İNFAZ',
  'ann.execution.sub': '{name} vuruldu',
  'ann.specialElection.title': 'ÖZEL SEÇİM',
  'ann.specialElection.sub': '{actor} sonraki başkanı seçti: {target}',
  'ann.chaos.title': 'KAOS',
  'ann.chaos.sub': 'Üç başarısız seçim: üstteki kanun uygulandı',
  'ann.chaos.fascist': 'Faşist kanun çıktı',
  'ann.chaos.liberal': 'Liberal kanun çıktı',

  // -------------------------------------------------------------------------
  // Alt eylem çubuğu (ActionBar) + kontrol ipuçları
  // -------------------------------------------------------------------------
  'actionbar.group': 'Yapılabilecek işlemler',
  'actionbar.blocked': 'Bağlantı kesik; işlem gönderilemiyor. Bağlantı gelince tekrar dene.',
  'actionbar.gameOver': 'Oyun bitti. Sonuç ekrandaki katmanda.',
  'actionbar.idle': 'Şu an yapman gereken bir şey yok. Diğer oyuncular bekleniyor.',
  'actionbar.browse': 'gezin',
  'actionbar.sending': 'Gönderiliyor…',
  'actionbar.confirm': 'Onayla',
  'actionbar.cancel': 'Vazgeç',
  'actionbar.shortcuts': 'Kısayollar',

  'hint.selected': 'Seçilen: {label}',
  'hint.willSend': 'Gönderilecek: {label}',
  'hint.confirm': 'Onayla',
  'hint.cancel': 'Vazgeç',
  'hint.pick': 'Seç',
  'hint.browse': 'Gözat',
  'hint.confirmStep': 'Onay adımı',
  'hint.pickFromBar': 'Seçim alt çubuktan (eller gizli)',
  'hint.identityClose': 'Kimliği kapat',
  'hint.identityOpen': 'Kimliğe bak',
  'hint.identity': 'Kimlik',
  'hint.backToTable': 'Masaya dön',
  'hint.leanBoard': 'Tahtaya eğil',
  'hint.board': 'Tahta',
  'hint.emote': 'Jest (basılı tut & bırak)',
  'hint.menuKeys': 'Menü / tuşlar',
  'hint.menu': 'Menü',
  'hint.camera': 'Kamera',
  'hint.emoteShort': 'Jest',
  'hint.pickHandsHidden': 'Seç · eller gizli',

  // -------------------------------------------------------------------------
  // Oyun ekranı (HUD)
  // -------------------------------------------------------------------------
  'game.playAgain': 'Aynı oyuncularla yeniden oyna',
  'game.returnLobby': 'Lobiye dön',
  'game.tools': 'Görünüm ve menü',
  'game.cameraGroup': 'Kamera ve inceleme',
  'game.overview': 'Genel masa',
  'game.seat': 'Kendi koltuğum',
  'game.privateArea': 'Özel alan',
  'game.board': 'Tahta',
  'game.exitFullscreen': 'Tam ekrandan çık',
  'game.fullscreen': 'Tam ekran',
  'game.enableLook': 'Bakışı etkinleştir',
  'game.releaseFocus': 'Odağı bırak',
  'game.focusGame': 'Oyuna odaklan',
  'game.menu': 'Menü',
  'game.fullscreenHint': '{enter} onaylar · {esc} odağı bırakır · {m} menü',
  'game.shotTitle': 'VURULDUN',
  'game.shotNote': 'Oyun bitene kadar izleyebilirsin; konuşma ve oy yok',
  'game.lookLocked': 'Bakış kilidi kapalı. Devam etmek için etkinleştir.',
  'game.overTitle': 'Oyun bitti',
  'game.hostRestart': 'Oda sahibi yeni oyunu başlatabilir.',
  'game.emote': 'Jest',

  // -------------------------------------------------------------------------
  // Menü (M)
  // -------------------------------------------------------------------------
  'menu.title': 'Menü',
  'menu.tabs': 'Menü sekmeleri',
  'menu.tab.settings': 'Ayarlar',
  'menu.tab.howto': 'Nasıl oynanır',
  'menu.tab.dev': 'Geliştirici',
  'menu.backToLook': 'Bakışa dön',
  'menu.prefs': 'Tercihler',
  'menu.pref.lowQuality': 'düşük grafik',
  'menu.pref.reducedMotion': 'hareketi azalt',
  'menu.pref.announcements': 'Duyurular',
  'menu.pref.sound': 'ses',
  'menu.pref.sensitivity': 'Fare hassasiyeti',
  'menu.pref.sensitivityValue': 'Fare hassasiyeti: {value}×',
  'menu.pref.seatCamera': 'kendi koltuğumdan bak (V)',
  'menu.pref.language': 'Dil',
  'menu.keys': 'Tuşlar',
  'menu.keysNote':
    'Oyunun her aşaması klavyeyle oynanabilir. Daha çok seçenek varsa oklarla gez, Enter ile onayla. Fare serbestken alt çubuktaki düğmeler de çalışır.',
  'menu.keysMore': 'Tüm kurallar ve her kuralın nereden kullanıldığı “Nasıl oynanır” sekmesinde.',
  'menu.devLoading': 'Geliştirici araçları yükleniyor…',
  'menu.key.activate': 'Bakılan hedefi seç (hamle onayı değil)',
  'menu.key.digits': 'Soldan sağa ilgili kartı / seçeneği seç',
  'menu.key.arrows': 'Yalnız inceleme / seçenek odağını değiştir',
  'menu.key.enter': 'Seçimi onay adımına getir; ayrı basışta gönder',
  'menu.key.backspace': 'Gönderilmemiş seçimi iptal et',
  'menu.key.identity': 'Kendi rol / özel el incelemesini aç-kapat',
  'menu.key.camera': 'Genel masa / koltuk kamerası',
  'menu.key.menu': 'Bu menü',
  'menu.key.escape': 'Tarayıcının kilit / tam ekran çıkışı (korunur)',

  // -------------------------------------------------------------------------
  // Paneller
  // -------------------------------------------------------------------------
  'panel.players': 'Oyuncular',
  'panel.lastVotesNote': 'Rozetler son oylamanın oylarıdır.',
  'panel.connected': 'bağlı',
  'panel.disconnected': 'bağlı değil',
  'panel.eliminated': 'elendi',
  'panel.voted': '✓ oy verdi',
  'panel.waiting': 'bekliyor',
  'panel.voteYes': '✓ evet',
  'panel.voteNo': '✕ hayır',

  'panel.table': 'Masa',
  'panel.pausedOffline': 'Duraklatıldı: oyuncu çevrimdışı',
  'panel.paused': 'Duraklatıldı: {reason}',
  'panel.liberal': 'Liberal',
  'panel.fascist': 'Faşist',
  'panel.tracker': 'Seçim sayacı',
  'panel.deckDiscard': 'Deste / Atık',
  'panel.power': 'Yetki',
  'panel.lastElection': 'Son seçim',
  'panel.accepted': 'kabul',
  'panel.rejected': 'ret',
  'panel.voteCount': '{yes} evet / {no} hayır',

  'panel.history': 'Tur geçmişi',
  'panel.historyEmpty': 'Henüz olay yok.',
  'history.gameStarted': 'Oyun başladı ({count} kişi).',
  'history.nomination': '{president}, {chancellor} adayını gösterdi.',
  'history.electionAccepted': 'Seçim kabul edildi.',
  'history.electionRejected': 'Seçim reddedildi.',
  'history.policyLiberal': 'Liberal kanun çıktı.',
  'history.policyFascist': 'Faşist kanun çıktı.',
  'history.tracker': 'Seçim sayacı: {tracker}.',
  'history.chaosLiberal': 'Kaos: liberal kanun çıktı.',
  'history.chaosFascist': 'Kaos: faşist kanun çıktı.',
  'history.powerUsed': 'Başkanlık yetkisi kullanıldı: {actor}',
  'history.powerUsedTarget': 'Başkanlık yetkisi kullanıldı: {actor} → {target}',
  'history.executed': '{name} infaz edildi.',

  // Özel bilgi paneli
  'role.panelTitle': 'Özel bilgin',
  'role.show': 'Göster',
  'role.hide': 'Gizle',
  'role.empty': 'Henüz özel bilgi yok.',
  'role.hidden': 'Rolün ve özel bilgin gizli. Görmek için “Göster”e bas.',
  'role.yourRole': 'Rolün',
  'role.known': 'Bildiklerin',
  'role.hand': 'Elin',
  'role.inspection': 'İnceleme',
  'role.deckTop': 'Deste tepesi',
  'role.yourVote': 'Oyun',
  'role.source.fascists_know_each_other': 'Faşistler birbirini tanır',
  'role.source.hitler_knows_fascists': 'Hitler faşistleri bilir',
  'role.source.investigate_loyalty': 'Sadakat incelemesi',

  // -------------------------------------------------------------------------
  // Jest çarkı (D16)
  // -------------------------------------------------------------------------
  'emote.menu': 'Jest menüsü',
  'emote.pick': 'Jest seç',
  'emote.confirm': 'Enter / sol tık',
  'emote.hint': '1–8 · ok tuşları · fare',
  'emote.back': 'Geri',
  'emote.point': 'İşaret',
  'emote.hands_up': 'Teslim',
  'emote.thumbs_up': 'Onay',
  'emote.thumbs_down': 'Ret',
  'emote.middle': 'Orta parmak',
  'emote.wave': 'Selam',
  'emote.clap': 'Alkış',
  'emote.facepalm': 'Yüz avuçlama',

  // -------------------------------------------------------------------------
  // Giriş / katıl / hata ekranları
  // -------------------------------------------------------------------------
  'entry.eyebrow': 'Gizli rol · masa oyunu',
  'entry.lead': 'Arkadaşlarınla tarayıcıda oynanan 5–10 kişilik gizli rol oyunu',
  'entry.name': 'Görünen adın',
  'entry.namePlaceholder': 'Örn. Mert',
  'entry.create': 'Oda aç',
  'entry.creating': 'Oda açılıyor…',
  'entry.or': 'veya',
  'entry.code': 'Davet kodu',
  'entry.codeHint': '6 karakter; oda sahibinin gönderdiği bağlantıda da yazar.',
  'entry.joinWithCode': 'Davet koduyla katıl',
  'entry.howTitle': 'Nasıl oynanır',
  'common.source': 'Kaynak kodu GitHub\'da',
  'entry.step1': 'Oda aç ve bağlantıyı gönder',
  'entry.step2': 'Herkes hazır olunca başlat',
  'entry.step3': 'Rolünü öğren, oy ver, kanun çıkar',
  'entry.footClientLive': 'canlı',
  'entry.footClientLocal': 'yerel',
  'entry.foot': 'sözleşme {contract} · protokol {protocol} · istemci {client}',

  // -------------------------------------------------------------------------
  // Solo demo (D26) — tarayıcıda, botlarla, sunucusuz
  // -------------------------------------------------------------------------
  'solo.you': 'Sen',
  'solo.try': 'Tek başına dene',
  'solo.starting': 'Masa kuruluyor…',
  'solo.hint': 'Arkadaşın yoksa: 5 botla dolu bir masa, her şey tarayıcında.',
  'solo.badge': 'Solo demo — botlar, hiçbir şey kaydedilmiyor',
  'solo.playWithFriends': 'Arkadaşlarınla oyna',
  'solo.error': 'Solo masa kurulamadı.',

  'join.title': 'Masaya otur',
  'join.invite': 'Davet',
  'join.submit': 'Katıl',
  'join.joining': 'Katılınıyor…',
  'join.backHome': '← Ana sayfaya dön',

  'notfound.title': 'Sayfa bulunamadı',
  'notfound.lead': 'Aradığın oda veya bağlantı burada değil.',
  'notfound.home': 'Ana sayfaya dön',

  'screen.loading': 'Bağlanılıyor…',
  'screen.roomLoading': 'Odaya bağlanılıyor…',
  'screen.errorTitle': 'Bir sorun oldu',
  'scene.failed': '3D masa yüklenemedi.',
  'scene.failedNote': 'Oyun kontrolleri aşağıda çalışmaya devam ediyor.',
  'scene.failedLabel': '3D masa yüklenemedi',
  'scene.loading': 'Sahne yükleniyor…',

  // -------------------------------------------------------------------------
  // Lobi
  // -------------------------------------------------------------------------
  'lobby.eyebrowDev': 'Lobi · yerel geliştirme',
  'lobby.eyebrowLive': 'Lobi · canlı',
  'lobby.room': 'Oda',
  'lobby.count': '{count} / {max} oyuncu',
  'lobby.min': 'en az {min}',
  'lobby.inviteLabel': 'Davet bağlantısı',
  'lobby.copy': 'Kopyala',
  'lobby.copied': 'Kopyalandı',
  'lobby.share': 'Paylaş',
  'lobby.shareText': 'Secret Table odasına katıl — kod {code}',
  'lobby.ready': 'Hazırım',
  'lobby.notReady': 'Hazır değilim',
  'lobby.start': 'Oyunu başlat',
  'lobby.hintHost': 'Oda sahibi başlatacak.',
  'lobby.hintNotEnough': 'En az {min} oyuncu gerekli ({count} var).',
  'lobby.hintNotReady': 'Herkesin hazır olması bekleniyor.',
  'lobby.seats': 'Masadaki oyuncular',
  'lobby.empty': 'Boş',
  'lobby.emptySeat': 'Boş koltuk {index}',
  'lobby.playersLabel': 'oyuncu',
  'lobby.readyCount': '{count} hazır',
  'lobby.srHost': ', oda sahibi',
  'lobby.srYou': ', sen',
  'lobby.srReady': ', hazır',
  'lobby.srWaiting': ', bekliyor',
  'lobby.srOffline': ', bağlı değil',
  'lobby.you': 'sen',

  // Karakter seçici
  'picker.title': 'Karakterin',
  'picker.character': 'Karakter',
  'picker.skin': 'Ten tonu',
  'picker.selected': 'Seçili karakter: {label}',
  'avatar.label': '{name}, {skin}',
  'avatar.biyikli-amca.name': 'Bıyıklı Amca',
  'avatar.biyikli-amca.tagline': 'BORDO YELEK · KEL · KALIN BIYIK',
  'avatar.gozluklu.name': 'Gözlüklü',
  'avatar.gozluklu.tagline': 'HARDAL KAZAK · YUVARLAK GÖZLÜK · DÜZ SAÇ',
  'avatar.topuzlu.name': 'Topuzlu',
  'avatar.topuzlu.tagline': 'ZÜMRÜT CEKET · TOPUZ · KÜPE',
  'avatar.fotr.name': 'Fötr',
  'avatar.fotr.tagline': 'LACİVERT · FÖTR · PAPYON · İNCE BIYIK',
  'avatar.sakalli.name': 'Sakallı',
  'avatar.sakalli.tagline': 'TURUNCU BERE · DOLGUN SAKAL · ZEYTİN KAZAK',
  'avatar.kivircik.name': 'Kıvırcık',
  'avatar.kivircik.tagline': 'MOR FULAR · KABARIK KIVIRCIK · BEJ KAZAK',
  'avatar.bereli-teyze.name': 'Bereli Teyze',
  'avatar.bereli-teyze.tagline': 'PEMBE HIRKA · BERE · GÖZLÜK ZİNCİRİ',
  'avatar.kepli-cocuk.name': 'Kepli Çocuk Kalpli',
  'avatar.kepli-cocuk.tagline': 'AÇIK MAVİ TİŞÖRT · KEP · ÇİLLER',
  'skin.acik': 'Açık ten',
  'skin.orta': 'Orta ten',
  'skin.koyu': 'Koyu ten',

  // Geliştirme botları (yalnız dev)
  'dev.botsTable': 'masa',
  'dev.botsTableLabel': 'Bot masası boyu',
  'dev.botsTitle':
    'Yalnız geliştirme: anonim botlar odaya katılır ve kendi sıralarını rastgele oynar (en çok 9 bot).',
  'dev.botsRunning': 'Botlar çalışıyor ({count})',
  'dev.botsAdd': '{count} bot ekle (dev)',

  // -------------------------------------------------------------------------
  // Nasıl oynanır (D19)
  // -------------------------------------------------------------------------
  'howto.intro':
    'Kurallar ve bu oyunda her kuralı nereden kullandığın. Tuşlar için en alttaki “Kontroller” bölümüne bak.',
  'howto.roleTable.caption': 'Oyuncu sayısına göre rol dağılımı',
  'howto.roleTable.players': 'Oyuncu',
  'howto.roleTable.liberal': 'Liberal',
  'howto.roleTable.fascist': 'Faşist',
  'howto.roleTable.hitler': 'Hitler',
  'howto.roleTable.knows': 'Hitler faşistleri bilir',
  'howto.yes': 'evet',
  'howto.no': 'hayır',
  'howto.powerTable.caption': 'Faşist tahtadaki yuva numarasına göre açılan başkanlık yetkisi',
  'howto.powerTable.gameEnds': 'oyun biter',
  'howto.powerCounts.none': 'bu oyunda yok',
  'howto.powerCounts.one': '{count} kişi',
  'howto.powerCounts.range': '{first}-{last} kişi',

  'howto.s1.title': '1. Amaç ve roller',
  'howto.s1.text':
    'Gizli rollerle oynanan bir blöf oyunu. Liberaller faşist takımı bulmaya, faşistler Hitler’i şansölye yapmaya ya da altı faşist kanun çıkarmaya çalışır.',
  'howto.s1.i1': 'Faşistler birbirini ve Hitler’i baştan bilir.',
  'howto.s1.i2':
    'Hitler faşistleri YALNIZ küçük masada ({counts} kişi) bilir; daha kalabalık masalarda Hitler kimseyi tanımaz ve kendini gizlemek zorundadır.',
  'howto.s1.i3': 'Liberaller kimseyi bilmez; sayı üstünlüğü onlardadır.',
  'howto.s1.i4':
    'Rol zarfın oyun boyunca elinin altında: H tuşu ya da araç çubuğundaki "Kimlik". Rolünü kimse görmez; ekranını gösterme.',

  'howto.s2.title': '2. Tur akışı',
  'howto.s2.i1': 'Başkanlık koltuk sırasıyla döner; sıradaki başkan aday gösterir.',
  'howto.s2.i2':
    'Aday gösterme: HUD’daki seçenek çubuğundan rakamla (1–{digits}) ya da masaya bakıp E ile oyuncuyu seç, sonra Enter ile onayla.',
  'howto.s2.i3':
    'Oylama: elinde EVET ve HAYIR kartı vardır; birini seçip gönderirsin. Oylar aynı anda açılır.',
  'howto.s2.i4': 'Hükümet için ÇOĞUNLUK gerekir; eşitlik REDDİR (yarıdan fazlası evet demeli).',
  'howto.s2.i5':
    'Seçim geçerse başkan ve şansölye yasamaya geçer; geçmezse seçim sayacı bir artar ve sıra bir sonraki oyuncuya gider.',

  'howto.s3.title': '3. Yasama',
  'howto.s3.i1':
    'Destede {liberal} liberal + {fascist} faşist = {total} kanun kartı vardır; deste tükenince çöp karıştırılıp yeni deste olur.',
  'howto.s3.i2':
    'Başkan {president} kart çeker ve birini ATAR; kalan {chancellor} kart şansölyeye geçer, şansölye birini YÜRÜRLÜĞE KOYAR, öteki çöpe gider.',
  'howto.s3.i3': 'Kartlar elinde durur: rakamla (1–{president}) seç, Enter ile gönder.',
  'howto.s3.i4':
    'Herkes kartların KAPALI sırtını görür: başkanın elinde {president}, şansölyenin elinde {chancellor} kart. Hangi kart olduğu görünmez.',
  'howto.s3.i5':
    'Konuşmak serbesttir; ama kartını göstermek, sayısını yalanlamak dışında bir kanıt sunamazsın — masada kart gösterme diye bir hamle yok.',

  'howto.s4.title': '4. Seçim sayacı ve kaos',
  'howto.s4.i1': 'Üst üste {max} seçim başarısız olursa (ret ya da kabul edilen veto) KAOS olur.',
  'howto.s4.i2': 'Kaos: destenin en üstündeki kart kimse görmeden kendiliğinden yürürlüğe girer.',
  'howto.s4.i3': 'Kaos politikası başkanlık yetkisi AÇMAZ.',
  'howto.s4.i4': 'Kaostan sonra tur kısıtları sıfırlanır: bir sonraki turda herkes şansölye adayı olabilir.',
  'howto.s4.i5':
    'Sayaç her başarılı kanunda sıfırlanır. Durum şeridinde kaç başarısız seçim olduğunu görürsün.',

  'howto.s5.title': '5. Aday sınırları (tur kısıtı)',
  'howto.s5.i1': 'Son SEÇİLMİŞ başkan ve şansölye bir sonraki turda şansölye adayı OLAMAZ.',
  'howto.s5.i2':
    'Hayatta {threshold} veya daha az oyuncu kaldıysa yalnız son ŞANSÖLYE kısıtlıdır; son başkan yeniden aday olabilir.',
  'howto.s5.i3': 'Başkan kendini şansölye yapamaz; elenmiş oyuncular aday olamaz.',
  'howto.s5.i4': 'Kısıtlı oyuncular seçenek listesinde hiç görünmez — yanlış hamle yapamazsın.',

  'howto.s6.title': '6. Başkanlık yetkileri',
  'howto.s6.text':
    'Faşist tahtada bir yuva HÜKÜMET eliyle dolunca o yuvanın yetkisi BAŞKANA geçer. Yetki o turda kullanılır; kullanılmadan tur kapanmaz.',
  'howto.s6.investigate':
    '{power} ({counts}): başkan bir oyuncu seçer; o oyuncunun LİBERAL mi FAŞİST mi olduğu yalnız başkana gösterilir — parti zarfı başkanın eline gelir, H ile bakılır. Rol (Hitler) değil, parti görünür. Bir oyuncu bir oyunda YALNIZ BİR KEZ incelenebilir; incelenmiş oyuncular hedef listesinde çıkmaz. Başkan gördüğünü onaylayınca tur kapanır.',
  'howto.s6.special':
    '{power} ({counts}): başkan sıradaki başkanı seçer. O oyuncu hemen aday belirler; tur bitince sıra normal koltuk düzeninde KALDIĞI YERDEN devam eder (sıra kaymaz). Seçilen kişi kendini şansölye yapamaz.',
  'howto.s6.peek':
    '{power} ({counts}): destenin üstündeki {president} kart başkanın eline kapalı gelir; yalnız başkan görür ve SIRASINI DEĞİŞTİREMEZ. Kartlar destede kalır, sonraki hükümet onları çeker.',
  'howto.s6.execution':
    '{power} ({counts}): başkan bir oyuncu seçer, elinde silah belirir ve hedef oyundan elenir. Elenen oyuncu konuşmaz, oy vermez ve başkanlık sırası onu atlar; kartı/rolü açılmaz. Vurulan kişi HİTLER’se liberaller hemen kazanır.',
  'howto.s6.after':
    'Yetki sende olduğunda HUD alt çubuğunda hedef listesi açılır: rakamla veya masaya bakıp E ile seç, Enter ile onayla. Sonucu geri alamazsın.',

  'howto.s7.title': '7. Veto',
  'howto.s7.i1': 'Veto ancak {slot}. faşist kanun çıktıktan sonra açılır.',
  'howto.s7.i2': 'Şansölye kartlarını gördükten sonra "Veto öner" düğmesini kullanır.',
  'howto.s7.i3': 'Başkan kabul veya ret eder; karar başkanındır.',
  'howto.s7.i4':
    'KABUL: iki kart da çöpe gider, kanun çıkmaz ve seçim sayacı bir artar (üçe gelirse kaos).',
  'howto.s7.i5':
    'RET: şansölye kartlardan birini yürürlüğe koymak ZORUNDADIR; aynı turda ikinci kez veto önerilemez.',

  'howto.s8.title': '8. Hitler bölgesi',
  'howto.s8.i1':
    '{slot} veya daha fazla faşist kanun çıktıktan sonra Hitler ŞANSÖLYE seçilirse faşistler anında kazanır.',
  'howto.s8.i2':
    'Bu yüzden o eşikten sonra her adaylık bir sınavdır: tanımadığın birini şansölye yapmak oyunu bitirebilir.',
  'howto.s8.i3': 'Oylama açılır açılmaz oyun biter; yasama yapılmaz.',
  'howto.s8.i4': 'Hitler aday gösterilip REDDEDİLİRSE oyun sürer, yalnız seçim sayacı artar.',

  'howto.s9.title': '9. Zafer koşulları',
  'howto.s9.i1': 'LİBERAL zafer: {slots} liberal kanun çıkar.',
  'howto.s9.i2': 'LİBERAL zafer: Hitler infaz edilir.',
  'howto.s9.i3': 'FAŞİST zafer: {slots} faşist kanun çıkar.',
  'howto.s9.i4': 'FAŞİST zafer: {slot}+ faşist kanunda Hitler şansölye seçilir.',
  'howto.s9.i5':
    'Oyun bitince tüm roller açılır; ev sahibi "Yeniden oyna" ile aynı masada yeni oyun başlatabilir.',

  'howto.s10.title': '10. Kontroller',
  'howto.s10.text': 'Oyunun her aşaması yalnız klavyeyle oynanabilir.',
  'howto.s10.i1':
    'Fare/odak: "Oyuna odaklan" ile tam ekran + fare kilidi açılır, bakışın masada gezer. Odağı bırakınca fare serbesttir ve alt çubuktaki düğmeler tıklanır.',
  'howto.s10.i2':
    'Kamera: genel masa (her şeyi görürsün), kendi koltuğum (ilk şahıs, ellerin görünür), tahtaya eğil (B — kanun tahtalarını yakından okur).',
  'howto.s10.i3':
    'Ses ve "hareketi azalt" ayarları Ayarlar sekmesinde; hareket azaltıldığında animasyonlar anında tamamlanır.',
  'howto.s10.i4':
    'Telefon: dokunarak seç, yine dokunarak onayla; "Jest" düğmesi çarkı açar, "Geri" kapatır. Ekran küçükse üst şerit sıkışır ama kaybolmaz.',
  'howto.s10.emotes': 'Jestler (G ile çark; çark açıkken rakamlar jest seçer):',

  // D29 — modal kabuğu.
  'howto.openButton': 'Nasıl oynanır',
  'howto.modalTitle': 'Nasıl oynanır',
  'howto.loading': 'Kılavuz yükleniyor…',

  // D29 — bölüm görsellerinin altyazıları (`howToPlayArt.tsx`).
  'howto.art.roles': 'Roller kapalı dağıtılır; kendi kartını yalnız sen görürsün.',
  'howto.art.round': 'Her tur aynı sırayla işler: aday → oylama → kanun.',
  'howto.art.legislation': 'Kartlar kimse görmeden elden ele geçer; atılanlar açılmaz.',
  'howto.art.tracker': 'Seçim sayacı her başarısız seçimde bir adım ilerler.',
  'howto.art.termLimit': 'Son seçilmiş hükümet bir sonraki turda aday olamaz.',
  'howto.art.boards':
    'İki tahta: liberal 5, faşist 6 yuva. Faşist yuvalar dolunca başkana yetki açılır.',
  'howto.art.veto': 'Veto: hükümet iki kartı da atabilir, ama seçim sayacı ilerler.',
  'howto.art.hitlerZone': 'Hitler bölgesi: bu noktadan sonra şansölye seçimi oyunu bitirebilir.',
  'howto.art.victory': 'Dört zafer yolu: ikisi liberal, ikisi faşist.',

  // D29 — görsellerin kendi etiketleri.
  'howto.art.board.label': '{party} tahtası · {slots} yuva · {players} oyuncu düzeni',
  'howto.art.board.hitlerZone': 'HİTLER BÖLGESİ',
  'howto.art.board.players': 'OYUNCU',
  'howto.art.board.size': 'Masa boyu',
  'howto.art.legend.victory': 'Son yuva dolarsa: {winner}',
  'howto.art.strip.label': '{total} yuvanın {filled} tanesi dolu',
  'howto.art.tracker.chaos': 'KAOS',
  'howto.art.role.liberal': 'Liberal: kimseyi bilmez, sayıca üstündür.',
  'howto.art.role.fascist': 'Faşist: diğer faşistleri ve Hitler’i bilir.',
  'howto.art.role.hitler': 'Hitler: faşist takımdadır, açığa çıkmamalıdır.',
  'howto.art.role.envelope': 'Kimlik zarfı: kendi rolünü H ile açarsın.',
  'howto.art.round.nominate': 'Başkan bir şansölye adayı gösterir.',
  'howto.art.round.vote': 'Herkes gizli oy verir.',
  'howto.art.round.enact': 'Hükümet kurulursa bir kanun çıkar.',
  'howto.art.legislation.draw': 'Başkan {count} kart çeker, birini atar.',
  'howto.art.legislation.pass': 'Şansölyeye {count} kart geçer.',
  'howto.art.legislation.enact': 'Şansölye birini yürürlüğe koyar.',
  'howto.art.termLimit.president': 'Son seçilmiş başkan.',
  'howto.art.termLimit.chancellor': 'Son seçilmiş şansölye.',
  'howto.art.veto.unlock': '{slot}. faşist kanundan sonra veto açılır.',
  'howto.art.veto.propose': 'Şansölye önerir, başkan karar verir.',
  'howto.art.veto.tracker': 'Kabul edilen veto sayacı ilerletir.',
  'howto.art.hitler.zone': '{slot}. faşist kanundan sonra bölge açılır.',
  'howto.art.hitler.elected': 'Hitler şansölye seçilirse…',
  'howto.art.hitler.win': '…oyun hemen biter: {winner}.',
  'howto.art.victory.liberalBoard': '{slots} liberal kanun çıkar.',
  'howto.art.victory.hitlerDead': 'Hitler infaz edilir.',
  'howto.art.victory.fascistBoard': '{slots} faşist kanun çıkar.',
  'howto.art.victory.hitlerChancellor': '{slot}+ faşist kanunda Hitler şansölye seçilir.',

  'howto.key.activate': 'Bakılan oyuncuyu / kartı seç (henüz gönderilmez)',
  'howto.key.digits': 'Seçeneği soldan sağa doğrudan seç',
  'howto.key.arrows': 'Seçenekler arasında gez',
  'howto.key.enter': 'Onay adımına getir; ikinci basışta gönder',
  'howto.key.backspace': 'Gönderilmemiş seçimi iptal et',
  'howto.key.identity': 'Kimlik: rol zarfı, elindeki kartlar, inceleme sonucu',
  'howto.key.camera': 'Kamera: genel masa ↔ kendi koltuğum',
  'howto.key.lean': 'Koltuktan tahtalara eğil (Esc ile geri)',
  'howto.key.emote': 'Jest çarkı (basılı tut, yönü seç, bırak)',
  'howto.key.menu': 'Menü (Ayarlar / Nasıl oynanır)',
  'howto.key.escape': 'Eğilmeden dön; tarayıcı kilit/tam ekran çıkışı',
  'howto.key.activateKeys': 'E / sol tık',
} as const;

export type TrKey = keyof typeof tr;
