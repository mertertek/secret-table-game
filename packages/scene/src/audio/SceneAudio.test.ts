import { afterEach, expect, it, vi } from 'vitest';
import { makeClap, makeSound, SceneAudio } from './SceneAudio';
import type { SoundKind } from './SceneAudio';
afterEach(() => vi.unstubAllGlobals());
it.each<SoundKind>(['paper', 'turn', 'wood', 'end', 'select'])('%s foley is finite, quiet, short, and smoothly ends', (kind) => {
  const samples = makeSound(kind, 48000);
  expect(samples.length).toBeLessThanOrEqual(48000 * .65);
  expect(samples.every((n) => Number.isFinite(n) && Math.abs(n) < .2)).toBe(true);
  expect(samples.some((n) => Math.abs(n) > .001)).toBe(true);
  expect(samples[0]).toBe(0); expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(.00001);
});
it('D16 clap: yumuşak çift vuruş, tepe ≤ .35, kısa ve sessizce biter', () => {
  const samples = makeClap(48000);
  expect(samples.length).toBeLessThanOrEqual(48000 * .3);
  let peak = 0;
  for (const value of samples) peak = Math.max(peak, Math.abs(value));
  expect(peak).toBeLessThanOrEqual(.35);
  expect(peak).toBeGreaterThan(.2);
  expect(samples.every(Number.isFinite)).toBe(true);
  expect(Math.abs(samples[0]!)).toBe(0);
  expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(.001);
  // İki vuruş: ilk 30 ms ve 95–125 ms pencerelerinde enerji var, arada düşer.
  const energy = (a: number, b: number) => samples.slice(Math.round(a * 48000), Math.round(b * 48000)).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  expect(energy(0, .03)).toBeGreaterThan(.2);
  expect(energy(.095, .125)).toBeGreaterThan(.1);
  expect(energy(.07, .09)).toBeLessThan(energy(.095, .125));
  expect(makeSound('clap', 48000).length).toBe(samples.length);
});
it('never queues locked sounds; mute stops voices; disposed engines stay silent', () => {
  const start = vi.fn(); const stop = vi.fn(); const close = vi.fn().mockResolvedValue(undefined);
  class FakeAudio {
    state = 'running'; sampleRate = 48000; destination = {};
    createBuffer() { return { copyToChannel() {} }; }
    createBufferSource() { return { connect() {}, disconnect() {}, start, stop, onended: null }; }
    close = close;
  }
  vi.stubGlobal('AudioContext', FakeAudio);
  const audio = new SceneAudio(); audio.setEnabled(true); audio.play('paper'); expect(start).not.toHaveBeenCalled();
  audio.unlock(); expect(start).not.toHaveBeenCalled(); audio.play('paper'); expect(start).toHaveBeenCalledTimes(1);
  audio.setEnabled(false); expect(stop).toHaveBeenCalledTimes(1); audio.play('wood'); expect(start).toHaveBeenCalledTimes(1);
  audio.dispose(); expect(close).toHaveBeenCalled(); audio.setEnabled(true); audio.play('end'); expect(start).toHaveBeenCalledTimes(1);
});
it('missing Web Audio does not break visual playback', () => {
  vi.stubGlobal('AudioContext', undefined);
  const audio = new SceneAudio(); expect(() => { audio.setEnabled(true); audio.unlock(); audio.play('paper'); audio.dispose(); }).not.toThrow();
});
