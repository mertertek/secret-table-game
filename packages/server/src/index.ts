/**
 * @secret-table/server — yalnız sunucu: odalar, atomik hamle kaydı, oyuncuya
 * göre görünüm projeksiyonu (gizli veri filtreleme), misafir oturum nesli ve
 * yeniden bağlanma (C03).
 *
 * Tarayıcı derlemesine dahil edilmez; yalnız `apps/web/api/*` içe aktarır.
 * Kalıcılık `GameGateway` arkasındadır: testler/erişimsiz yerel çalışma için
 * `InMemoryGateway`, üretim için `SupabaseGateway`.
 */

import { CONTRACT_VERSION, PROTOCOL_VERSION } from '@secret-table/contracts';

export { GameService } from './service';
export type { ServiceOptions, ActorRef } from './service';

export { InMemoryGateway } from './memory-gateway';
export type { RevisionListener } from './memory-gateway';

export { SupabaseGateway } from './supabase-gateway';
export type { SupabaseGatewayConfig } from './supabase-gateway';

export type {
  GameGateway,
  RoomRecord,
  MemberRecord,
  GameStateRecord,
  ProcessedCommandRecord,
  SessionRecord,
  RoomStatus,
  CommitMoveInput,
  CommitMoveResult,
} from './gateway';

export { projectView, projectActions, eventsToCues, phaseIdOf, resolveAvatars } from './projection';
export type { ProjectionMeta } from './projection';
export { resolveEngineCommand } from './engine-map';
export { mapEngineError, messageKeyForError } from './errors';

export const serverInfo = {
  contractVersion: CONTRACT_VERSION,
  protocolVersion: PROTOCOL_VERSION,
} as const;
