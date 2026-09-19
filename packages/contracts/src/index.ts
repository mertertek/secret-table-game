/**
 * @secret-table/contracts — oyun uygulaması ile 3D sahne ve ağ katmanı arasındaki
 * tek tip kaynağı. Sürüm 0.2.0 (sabit, docs/CONTRACT.md).
 *
 * Yalnız tipler bu girişten alınır. Çalışma anı doğrulama şemaları için
 * `@secret-table/contracts/schemas` alt yolunu kullan (zod bağımlılığı oradadır).
 */

export type * from './ids';
export type * from './scene';
export type * from './commands';
/** D19 — dev senaryo adları DEĞER olarak da gerekir (şema enum'u + dev menüsü). */
export { DEV_SCENARIO_NAMES } from './commands';
export type * from './lobby';
export * from './rules';
export * from './viewpoint';
export * from './avatars';

/** Ağ protokolü sürümü. docs/CONTRACT.md 0.2.0 revizyonundan farklı kavram. */
export const PROTOCOL_VERSION = 1 as const;

/**
 * Bu sözleşme paketinin revizyonu. 2026-09-09'da Codex (CODEX-004) ortak tipleri
 * fark olmadan kabul etti; sürüm `0.2.0` olarak sabitlendi.
 */
export const CONTRACT_VERSION = '0.2.0' as const;
