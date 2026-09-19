import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, SphereGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { palette } from '../materials/palette';

type Part = { geometry: BufferGeometry; color: string; x?: number; y?: number; z?: number; tilt?: number };
function merge(parts: Part[]) {
  const colored = parts.map(({ geometry, color, x = 0, y = 0, z = 0, tilt = 0 }) => {
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    part.rotateZ(tilt); part.translate(x, y, z); part.deleteAttribute('uv');
    const rgb = new Color(color), colors = new Float32Array(part.getAttribute('position').count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = rgb.r; colors[i + 1] = rgb.g; colors[i + 2] = rgb.b; }
    part.setAttribute('color', new BufferAttribute(colors, 3));
    return part;
  });
  const result = mergeGeometries(colored);
  colored.forEach((part) => part.dispose());
  if (!result) throw new Error('Mobilya geometrisi birleştirilemedi.');
  return result;
}
const box = (x: number, y: number, z: number, radius: number) => new RoundedBoxGeometry(x, y, z, 2, Math.min(radius, x / 2, y / 2, z / 2));
export function chairGeometry() {
  return merge([
    { geometry: box(.49, .07, .46, .03), color: palette.walnut, y: .34 },
    { geometry: box(.44, .07, .41, .03), color: palette.leather, y: .4 },
    { geometry: box(.49, .52, .07, .025), color: palette.walnut, y: .64, z: .2 },
    { geometry: box(.41, .39, .045, .018), color: palette.leather, y: .66, z: .151 },
    ...[-.18, .18].flatMap((x) => [-.15, .15].map((z) => ({ geometry: new CylinderGeometry(.024, .018, .32, 8), color: palette.walnut, x, y: .16, z }))),
  ]);
}
export function avatarGeometry(seatIndex: number, alive: boolean) {
  const coats = ['#465c53', '#5b6257', '#696055', '#3c5150', '#645951'];
  const coat = alive ? coats[seatIndex % coats.length]! : '#393d38';
  const skin = alive ? '#b9a084' : '#737266';
  const hair = new SphereGeometry(.109, 16, 8, 0, Math.PI * 2, 0, Math.PI * .51);
  hair.rotateX(-.2);
  return merge([
    { geometry: new CylinderGeometry(.085, .14, .23, 8), color: coat, y: .09 },
    { geometry: new SphereGeometry(.105, 16, 12), color: skin, y: .31, z: -.01 },
    { geometry: hair, color: seatIndex % 3 === 0 ? '#777264' : '#48463d', y: .355, z: .016 },
    { geometry: new SphereGeometry(.022, 8, 6), color: skin, y: .31, z: -.11 },
    ...[-.042, .042].map((x) => ({ geometry: new SphereGeometry(.009, 8, 6), color: '#292d29', x, y: .33, z: -.102 })),
    ...[-1, 1].flatMap((side) => [
      { geometry: new CylinderGeometry(.04, .033, .19, 8), color: coat, x: side * .12, y: .09, z: -.028, tilt: side * -.22 },
      { geometry: new SphereGeometry(.036, 10, 8), color: skin, x: side * .1, y: -.015, z: -.03 },
    ]),
    { geometry: box(.047, .085, .016, .004), color: '#dccbad', y: .14, z: -.089 },
  ]);
}
