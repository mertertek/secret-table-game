import { useSearchParams } from 'react-router-dom';
import { HandGallery, type HandGalleryView } from '@secret-table/scene';
import type { GripName } from '@secret-table/scene';

/**
 * `/dev/hands?grip=holdFan3&view=palm|back|tips&zoom=1.4` — YALNIZ geliştirme
 * girişi (routes.tsx `import.meta.env.DEV`). Tek el, düz zemin, tek yönlü ışık:
 * D1 kavramalarında yapışık/birleşik bölge aramak için.
 */
export function DevHandsPage() {
  const [params] = useSearchParams();
  const grip = (params.get('grip') ?? 'rest') as GripName;
  const view = (params.get('view') ?? 'palm') as HandGalleryView;
  const zoom = Number(params.get('zoom') ?? '1');
  return <div style={{ position: 'fixed', inset: 0 }}>
    <HandGallery grip={grip} view={view} zoom={Number.isFinite(zoom) && zoom > 0 ? zoom : 1}
      skin={(params.get('skin') ?? 'orta') as 'acik' | 'orta' | 'koyu'}
      tier={params.get('tier') === 'low' ? 'low' : 'standard'} />
  </div>;
}

export default DevHandsPage;
