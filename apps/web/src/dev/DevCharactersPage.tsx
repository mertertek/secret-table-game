import { useSearchParams } from 'react-router-dom';
import { CharacterGallery } from '@secret-table/scene';

/**
 * `/dev/characters?mode=lineup|faces|skins&character=…&skin=…` — YALNIZ
 * geliştirme girişi (routes.tsx `import.meta.env.DEV`). Oyun verisi, ağ ya da
 * rol yoktur; D3 karakter üretimini görsel kontrol içindir.
 */
export function DevCharactersPage() {
  const [params] = useSearchParams();
  const mode = (params.get('mode') ?? 'lineup') as 'lineup' | 'faces' | 'skins';
  const character = params.get('character') ?? undefined;
  const skin = (params.get('skin') ?? 'orta') as 'acik' | 'orta' | 'koyu';
  return <div style={{ position: 'fixed', inset: 0 }}>
    <CharacterGallery mode={mode} character={character} skin={skin} reducedMotion={params.get('still') === '1'} />
  </div>;
}
