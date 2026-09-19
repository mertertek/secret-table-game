/**
 * D3.4 — lobideki TEK karakter 3D önizlemesi.
 *
 * Ayrı dosyadır çünkü `@secret-table/scene` (three + R3F) buradan çekilir:
 * `AvatarPicker` bunu `lazy()` ile yükler, böylece lobi ilk boyamada three
 * beklemez (B6: giriş/lobi hafif kalır) ve jsdom testleri bu modülü tek
 * satırla taklit edebilir.
 *
 * Bütçe: tek Canvas, tek karakter → gövde + yüz + eller ≤3 çizim, zemin 1.
 */
import { CharacterGallery } from '@secret-table/scene';
import type { AvatarCharacterId, AvatarSkinId } from '@secret-table/contracts';

export default function AvatarPreview({
  character,
  skin,
  reducedMotion = false,
}: {
  character: AvatarCharacterId;
  skin: AvatarSkinId;
  reducedMotion?: boolean;
}) {
  return <CharacterGallery mode="single" character={character} skin={skin} reducedMotion={reducedMotion} />;
}
