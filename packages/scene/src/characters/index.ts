/** D3 — prosedürel karakterler (`docs/design/D3-characters.md`). */
export { CharacterAvatar, SEAT_OFFSET_Y } from './CharacterAvatar';
export { characterGeometry, disposeCharacterGeometry, TIERS } from './geometry';
export { characterField, clearFieldCache, evalPrim } from './field';
export { buildRig, boneCandidates, boneDefs, skinWeights } from './skeleton';
export { palette, vertexColor, darken, colorFromKey, primColorKey, boundaryDistance, frontScore, neckScore, BOUNDARY_LIMIT, MIN_BAND, NO_BOUNDARY } from './colors';
export type { ColorKey, BoundaryMech } from './colors';
export { boundaryMaterial, patchBoundaryShader, BOUNDARY_CACHE_KEY } from './boundaryMaterial';
export { BLINK_FRAMES, BLINK_MS, blinkLid, drawFace, expressionParams, nextBlinkDelay, FaceTexture } from './face';
export {
  CHARACTERS, CHARACTER_IDS, SKIN_IDS, SPEC,
  avatarForSeat, characterSpec, hasAccessory, labelHeight, mouthOffset, parseAvatar, skinTones,
} from './spec';
export type { AvatarSelection, CharacterSpec, ExpressionName, SkinId, Tier } from './spec';
