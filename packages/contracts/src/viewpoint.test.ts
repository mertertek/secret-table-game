import { describe, expect, it } from 'vitest';

import {
  EMOTE_COOLDOWN_MS,
  EMOTE_DURATION_MS,
  EMOTE_KINDS,
  EMOTE_LABEL,
  EMOTE_MAX_DURATION_MS,
  EMOTE_REPEAT_MS,
  EMOTE_SYMBOL,
  VIEWPOINT_MIN_DELTA,
  VIEWPOINT_PITCH_LIMIT,
  VIEWPOINT_YAW_LIMIT,
  clampViewpoint,
  emoteExpired,
  isEmoteKind,
  viewpointChanged,
} from './viewpoint';

describe('clampViewpoint', () => {
  it('sınırların içinde değeri korur', () => {
    expect(clampViewpoint({ yaw: 0.3, pitch: -0.2 })).toEqual({ yaw: 0.3, pitch: -0.2 });
  });

  it('yaw / pitch değerlerini kendi sınırına kırpar', () => {
    const out = clampViewpoint({ yaw: 99, pitch: -99 });
    expect(out.yaw).toBe(VIEWPOINT_YAW_LIMIT);
    expect(out.pitch).toBe(-VIEWPOINT_PITCH_LIMIT);
  });

  it('sonlu olmayan girdiyi 0 yapar', () => {
    expect(clampViewpoint({ yaw: Number.NaN, pitch: Infinity })).toEqual({ yaw: 0, pitch: 0 });
  });
});

describe('viewpointChanged', () => {
  it('eşik altındaki değişimi yok sayar', () => {
    const a = { yaw: 0.1, pitch: 0.1 };
    const b = { yaw: 0.1 + VIEWPOINT_MIN_DELTA / 2, pitch: 0.1 };
    expect(viewpointChanged(a, b)).toBe(false);
  });

  it('eşiği aşan değişimi bildirir', () => {
    const a = { yaw: 0.1, pitch: 0.1 };
    const b = { yaw: 0.1 + VIEWPOINT_MIN_DELTA * 1.5, pitch: 0.1 };
    expect(viewpointChanged(a, b)).toBe(true);
  });
});

describe('D16 — el jestleri (additive)', () => {
  it('sekiz jest, süre tablosu ve metin tabloları eksiksiz', () => {
    expect(EMOTE_KINDS).toEqual([
      'point', 'hands_up', 'thumbs_up', 'thumbs_down', 'middle', 'wave', 'clap', 'facepalm',
    ]);
    for (const kind of EMOTE_KINDS) {
      expect(Number.isInteger(EMOTE_DURATION_MS[kind])).toBe(true);
      expect(EMOTE_DURATION_MS[kind]).toBeLessThanOrEqual(EMOTE_MAX_DURATION_MS);
      expect(EMOTE_SYMBOL[kind]).toBeTruthy();
      expect(EMOTE_LABEL[kind]).toBeTruthy();
    }
    expect(EMOTE_COOLDOWN_MS).toBe(1200);
    expect(EMOTE_REPEAT_MS).toEqual([250, 600]);
  });

  it('bilinmeyen jest adı reddedilir, süre sonu bildirilir', () => {
    expect(isEmoteKind('point')).toBe(true);
    for (const value of ['dab', '', 'POINT', null, 7, {}]) expect(isEmoteKind(value)).toBe(false);
    expect(emoteExpired('wave', 0)).toBe(false);
    expect(emoteExpired('wave', EMOTE_DURATION_MS.wave - 1)).toBe(false);
    expect(emoteExpired('wave', EMOTE_DURATION_MS.wave)).toBe(true);
    expect(emoteExpired('wave', Number.NaN)).toBe(true);
    expect(emoteExpired('wave', -1)).toBe(true);
  });
});
