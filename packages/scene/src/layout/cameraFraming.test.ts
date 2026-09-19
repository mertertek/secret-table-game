import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { BOARD_SPAN, LEAN_TARGET, cameraFrame, leanFrame } from './cameraFraming';

describe('inspection framing', () => {
  it.each([[390, 380], [844, 390], [1150, 751]])('fits a focused card and both board variants at %sx%s', (width, height) => {
    for (const mode of ['private', 'liberal', 'fascist'] as const) {
      const frame = cameraFrame(mode, width, height, .34);
      const camera = new PerspectiveCamera(40, width / height, .1, 100);
      camera.position.set(...frame.eye); camera.lookAt(new Vector3(...frame.target)); camera.updateMatrixWorld();
      const x = mode === 'private' ? .34 : 0, z = mode === 'private' ? .97 : mode === 'liberal' ? -.4 : .16;
      const halfX = mode === 'private' ? .15 : .98, halfZ = mode === 'private' ? .23 : .24;
      // D10: tahta kadrajı genişliğe oturtuldu (%94), bu yüzden tahta kipinde eşik .96.
      const limitX = mode === 'private' ? .95 : .96;
      for (const dx of [-halfX, halfX]) for (const dz of [-halfZ, halfZ]) {
        const point = new Vector3(x + dx, .06, z + dz).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(limitX);
        expect(Math.abs(point.y)).toBeLessThan(.80);
        expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1);
      }
    }
  });
  // D10: inceleme kamerası tahtanın 1,94 m genişliğine oturur — eski sabitten yakın,
  // ama tahtanın gerçek köşeleri (±.97 / ±.225) kadrajın içinde kalır.
  it.each([[390, 380], [844, 390], [1150, 751], [1440, 900], [1920, 1080]])(
    'zooms the board inspection in without clipping the board at %sx%s', (width, height) => {
      for (const mode of ['liberal', 'fascist'] as const) {
        const frame = cameraFrame(mode, width, height);
        const camera = new PerspectiveCamera(40, width / height, .1, 100);
        camera.position.set(...frame.eye); camera.lookAt(new Vector3(...frame.target)); camera.updateMatrixWorld();
        const z = mode === 'liberal' ? -.4 : .16;
        let widest = 0;
        for (const dx of [-.97, .97]) for (const dz of [-.225, .225]) {
          widest = Math.max(widest, Math.abs(new Vector3(dx, .06, z + dz).project(camera).x));
        }
        // Tahta ekranın en az %88'ini kaplar ve kırpılmaz (eski kadrajda ~%87 idi).
        expect(widest).toBeGreaterThan(.88);
        expect(widest).toBeLessThan(.95);
      }
    });
  it('retains overview framing and moves only the camera target between private cards', () => {
    expect(cameraFrame('overview', 1440, 1000)).toEqual({ eye: [0, 7.8 * .76, 7.8 * .65], target: [0, 0, .12] });
    const first = cameraFrame('private', 390, 380, -.34), last = cameraFrame('private', 390, 380, .34);
    expect(first.eye.slice(1)).toEqual(last.eye.slice(1)); expect(first.target[0]).toBe(-.34); expect(last.target[0]).toBe(.34);
  });
});

describe('tahtaya eğilme kadrajı (D15)', () => {
  /** Yerel koltuk `layout/seats.ts` ile aynı: açı 0 → x 0, z 2.0. */
  const chair = [0, -.74, 2] as const;
  const seatEye = { x: chair[0], z: chair[2] + .035 };
  const sizes: [number, number][] = [[1920, 1080], [1440, 900], [1280, 720], [844, 390], [390, 844], [1080, 1920], [768, 1024], [390, 380]];

  it.each(sizes)('iki tahtanın dört köşesini de görüş piramidinde tutar (%sx%s)', (width, height) => {
    const frame = leanFrame(chair, width, height);
    const camera = new PerspectiveCamera(frame.fov, width / height, .025, 100);
    camera.position.set(...frame.eye); camera.lookAt(new Vector3(...frame.target)); camera.updateMatrixWorld();
    for (const dx of [-BOARD_SPAN.halfWidth, BOARD_SPAN.halfWidth]) for (const dz of [BOARD_SPAN.farZ, BOARD_SPAN.nearZ]) {
      const point = new Vector3(dx, .06, dz).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(1);
      expect(Math.abs(point.y)).toBeLessThan(1);
      expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1);
    }
    // Tahtalar kadrajı gerçekten doldurur (yatayda en az %80).
    const widest = Math.max(...[-BOARD_SPAN.halfWidth, BOARD_SPAN.halfWidth].map((dx) =>
      Math.max(...[BOARD_SPAN.farZ, BOARD_SPAN.nearZ].map((dz) => Math.abs(new Vector3(dx, .06, dz).project(camera).x)))));
    expect(widest).toBeGreaterThan(.80);
  });

  it.each(sizes)('göz kendi koltuğunun tarafında ve koltuğun önünde kalır (%sx%s)', (width, height) => {
    const frame = leanFrame(chair, width, height);
    const toSeat = seatEye.z - LEAN_TARGET[2];
    const toEye = frame.eye[2] - LEAN_TARGET[2];
    expect(Math.sign(toEye)).toBe(Math.sign(toSeat)); // merkezin karşı tarafına geçmez
    expect(Math.abs(toEye)).toBeLessThanOrEqual(Math.abs(toSeat) + 1e-9); // koltuğun gerisine kaçmaz
    expect(Math.abs(toEye)).toBeGreaterThan(BOARD_SPAN.nearZ - LEAN_TARGET[2]); // yakın tahtanın üstünde durmaz
    expect(frame.eye[0]).toBeCloseTo(chair[0], 6);
  });

  it.each(sizes)('tepeden dik bakış değil: eğim ve yükseklik sınırlı (%sx%s)', (width, height) => {
    const frame = leanFrame(chair, width, height);
    const offset = Math.hypot(frame.eye[0] - LEAN_TARGET[0], frame.eye[2] - LEAN_TARGET[2]);
    const elevation = Math.atan2(frame.eye[1] - LEAN_TARGET[1], offset) * 180 / Math.PI;
    expect(elevation).toBeGreaterThan(40);
    expect(elevation).toBeLessThan(70); // eski tepeden inceleme ~74°
    expect(frame.eye[1]).toBeGreaterThan(.51); // koltuk göz hizasının üstüne çıkar
    expect(frame.eye[1]).toBeLessThan(2.6);
    expect(frame.fov).toBeGreaterThanOrEqual(40);
    expect(frame.fov).toBeLessThanOrEqual(90);
  });

  it('yatay ekranda eğilme 45–55°; 16:9 ve daha geniş ekranda fov 40–44°', () => {
    for (const [width, height] of [[1920, 1080], [1440, 900], [844, 390]] as const) {
      const frame = leanFrame(chair, width, height);
      const offset = Math.hypot(frame.eye[0], frame.eye[2] - LEAN_TARGET[2]);
      const elevation = Math.atan2(frame.eye[1] - LEAN_TARGET[1], offset) * 180 / Math.PI;
      expect(elevation).toBeGreaterThanOrEqual(45);
      expect(elevation).toBeLessThanOrEqual(55);
      // 16:10 gibi daha dar yatay ekranda kadrajı tutturmak için fov birkaç derece açılır.
      expect(frame.fov).toBeLessThanOrEqual(width / height >= 16 / 9 ? 44 : 49);
      expect(frame.fov).toBeGreaterThanOrEqual(40);
    }
  });

  it('telefon dikeyde iki tahta arka arkaya kalır: yakın tahta ekranda daha aşağıda', () => {
    for (const [width, height] of [[390, 844], [1080, 1920], [1920, 1080]] as const) {
      const frame = leanFrame(chair, width, height);
      const camera = new PerspectiveCamera(frame.fov, width / height, .025, 100);
      camera.position.set(...frame.eye); camera.lookAt(new Vector3(...frame.target)); camera.updateMatrixWorld();
      const near = new Vector3(0, .06, .16).project(camera); // faşist tahta (koltuğa yakın)
      const far = new Vector3(0, .06, -.4).project(camera); // liberal tahta
      expect(near.y).toBeLessThan(far.y);
    }
  });

  it('yan koltuk kendi tarafından bakar (kadraj koltuğa göre döner)', () => {
    const side = [2.64, -.74, 0] as const; // açı 90°: sağ taraftaki koltuk
    const frame = leanFrame(side, 1440, 900);
    expect(frame.eye[0]).toBeGreaterThan(LEAN_TARGET[0]); // göz koltuk tarafında
    expect(Math.abs(frame.eye[2] - LEAN_TARGET[2])).toBeLessThan(.35);
  });
});
