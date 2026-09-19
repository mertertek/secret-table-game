import { Component, type ErrorInfo, type ReactNode, Suspense, lazy } from 'react';

import { useT } from '../i18n';
import type {
  ImmersiveSceneProps,
  SceneCue,
  SceneIntent,
  SceneQuality,
  SceneSelection,
  SceneView,
} from '@secret-table/contracts';

/**
 * 3D sahneyi saran boyutlu kap + yükleme sınırı + WebGL/varlık hata sınırı
 * (docs/CONTRACT.md § 1, § 8). Sonsuz yükleme ekranı olmaz; hata anlaşılır
 * bir görünüme düşer ve HTML kontroller çalışmaya devam eder.
 *
 * ROADMAP §C/2: `@secret-table/scene` (three + R3F + drei) AYRI chunk'tır ve
 * yalnız oyun ekranı bağlanınca indirilir. Giriş (`/`), `/katil` ve lobi bu
 * paketi indirmez; lobi `preloadScene()` ile arka planda ön-yükler.
 */

/** Sahne chunk'ının tek `import()` noktası; ön-yükleme ve `lazy` aynı sözü paylaşır. */
const importScene = () => import('@secret-table/scene');

/**
 * Sahne paketini arka planda indirmeye başlar (lobi). Hata yutulur: gerçek
 * yükleme/başarısızlık `SceneFrame` içindeki Suspense + hata sınırında görünür.
 */
export function preloadScene(): void {
  void importScene().catch(() => undefined);
}

type BoundaryProps = { children: ReactNode; fallback: ReactNode };
type BoundaryState = { failed: boolean };

class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Gizli veri yok; yalnız kısa uyarı.
    console.warn('[scene] render hatası', error.message, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type SceneFrameProps = {
  view: SceneView;
  cues: readonly SceneCue[];
  selection: SceneSelection | null;
  onIntent: (intent: SceneIntent) => void;
  quality: SceneQuality;
  reducedMotion: boolean;
  soundEnabled: boolean;
  /** Özel bilgi paneli açık/kapalı — uygulamanın tek kaynağı (QA-R02). */
  rolePanelOpen?: boolean;
  /** Açık reset nesli (FINISH_PLAN §3). */
  resetEpoch?: number;
  /** İlk-şahıs / koltuk kamerası bağlantısı (FINISH_PLAN §2, §4). */
  immersive?: ImmersiveSceneProps;
  /**
   * D11: sahnenin kendi sağ üst kamera/inceleme şeridi. Üretimde `false`;
   * tek araç çubuğu HUD'dadır. `/dev/scene` doğrudan `TableScene` kullanır ve
   * varsayılan (çizilir) davranışı korur.
   */
  showInspectionNav?: boolean;
  /** D11: tahta incelemesi uygulama denetiminde (tek kaynak). D15: `lean` = koltuktan eğilme. */
  boardInspection?: 'off' | 'liberal' | 'fascist' | 'lean';
  onBoardInspectionChange?: (next: 'off' | 'liberal' | 'fascist' | 'lean') => void;
  /** D23 — sahnenin çizeceği metinlerin dili (additive; varsayılan `tr`). */
  language?: 'tr' | 'en';
};

const LazyTableScene = lazy(() => importScene().then((m) => ({ default: m.TableScene })));

function SceneFallback() {
  const t = useT();
  return (
    <div className="scene-frame__fallback" role="img" aria-label={t('scene.failedLabel')}>
      <p>{t('scene.failed')}</p>
      <p className="muted">{t('scene.failedNote')}</p>
    </div>
  );
}

function SceneLoading() {
  const t = useT();
  return <div className="scene-frame__loading">{t('scene.loading')}</div>;
}

export function SceneFrame(props: SceneFrameProps) {
  return (
    <div className="scene-frame">
      <SceneErrorBoundary fallback={<SceneFallback />}>
        <Suspense fallback={<SceneLoading />}>
          <LazyTableScene {...props} />
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
