import { fanCard } from './grip';
import { mixTransform, smooth } from './rig';
import type { Transform } from './model';

/** Keeps only transforms and opaque IDs, never old private faces. Surviving cards
 * close around the same grip after a removal, starting at their last drawn pose. */
export class FanLayout {
  private ids = '';
  private startedAt = 0;
  private from = new Map<string, Transform>();
  private drawn = new Map<string, Transform>();
  remember(id: string, transform: Transform) { this.drawn.set(id, transform); }
  update(ids: readonly string[], now: number, reduced: boolean, lifts: readonly number[] = []) {
    const key = JSON.stringify(ids);
    if (key !== this.ids) {
      this.from = new Map(ids.flatMap((id) => this.drawn.has(id) ? [[id, this.drawn.get(id)!] as const] : []));
      this.drawn = new Map(); this.ids = key; this.startedAt = now;
    }
    const p = reduced ? 1 : smooth((now - this.startedAt) / 240);
    ids.forEach((id, index) => {
      const target = fanCard(index, ids.length, lifts[index] ?? 0);
      this.drawn.set(id, p < 1 && this.from.has(id) ? mixTransform(this.from.get(id)!, target, p) : target);
    });
    return { transforms: this.drawn, moving: p < 1 && this.from.size > 0 };
  }
}
