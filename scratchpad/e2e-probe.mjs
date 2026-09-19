import { launch, makeCtx, BASE, sceneReady } from './e2e-lib.mjs';
const browser = await launch();
const { p } = await makeCtx(browser, 'P');
await p.goto(`${BASE}/dev/scene?fixture=legislative-president-seat&camera=seat`);
await sceneReady(p);
const probe = await p.evaluate(() => {
  const c0 = document.querySelector('canvas');
  const fk = Object.keys(c0).find((k) => k.startsWith('__reactFiber'));
  let f = c0[fk];
  const found = [];
  let hops = 0;
  const isStore = (v) => v && typeof v.getState === 'function' && (() => { try { const s = v.getState(); return s && s.scene && s.camera; } catch { return false; } })();
  while (f && hops < 60) {
    for (const bag of [f.memoizedProps, f.memoizedState, f.stateNode]) {
      if (!bag || typeof bag !== 'object') continue;
      for (const k of Object.keys(bag)) { if (isStore(bag[k])) found.push(`prop:${k}@${hops}`); }
      if (isStore(bag)) found.push(`bag@${hops}`);
    }
    let hook = f.memoizedState;
    let hi = 0;
    while (hook && hi < 30) { if (isStore(hook.memoizedState)) found.push(`hook${hi}@${hops}`); hook = hook.next; hi++; }
    if (found.length) { window.__store = (() => { let fr = c0[fk], h2 = 0; return null; })(); break; }
    f = f.return; hops++;
  }
  window.__fiberFound = found;
  return { found, hops };
});
console.log('FIBER', JSON.stringify(probe));
const probe2 = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const keys = Object.keys(c).concat(Object.keys(c.parentElement || {}));
  const r3f = c.__r3f || c.parentElement?.__r3f;
  let info = null;
  if (r3f) {
    const store = r3f.store || r3f.root || null;
    const s = store?.getState ? store.getState() : null;
    if (s) {
      const cam = s.camera;
      const names = [];
      s.scene.traverse((o) => { if (o.name) names.push(`${o.type}:${o.name}`); });
      info = { cam: [cam.position.x.toFixed(3), cam.position.y.toFixed(3), cam.position.z.toFixed(3)], rot: [cam.rotation.x.toFixed(3), cam.rotation.y.toFixed(3)], objects: s.scene.children.length, names: names.slice(0, 60) };
    }
  }
  return { keys: keys.slice(0, 20), hasR3f: !!r3f, info };
});
console.log(JSON.stringify(probe2, null, 1).slice(0, 4000));
await browser.close();
