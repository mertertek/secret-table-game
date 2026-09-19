import type { EmoteKind, SceneCue, SceneSelection, SceneView } from '@secret-table/contracts';

/**
 * D16 — sentetik uzak oyuncu bakışı/jesti. `/dev/scene` bunu her seferinde
 * TAZE `t` ile gerçek `HeadViewpoint`e çevirir (bayatlık alıcı saatindedir).
 */
export type PeerFixture = {
  playerId: string;
  seatIndex: number;
  yaw: number;
  pitch: number;
  emote?: EmoteKind;
};

/** /dev/scene sayfasında listelenen tek bir sentetik sahne senaryosu. */
export type SceneFixture = {
  /** Kararlı kimlik; /dev/scene URL parametresi bununla eşlenir. */
  id: string;
  /** Kısa Türkçe başlık. */
  title: string;
  /** Senaryonun neyi gösterdiğine dair bir cümle. */
  description: string;
  view: SceneView;
  cues: readonly SceneCue[];
  /** Uygulamanın tuttuğu yerel seçim; çoğu senaryoda `null`. */
  selection: SceneSelection | null;
  /** D16 — karşıdaki oyuncuların paylaşılan bakışı/jesti (yalnız /dev/scene). */
  peers?: readonly PeerFixture[];
};
