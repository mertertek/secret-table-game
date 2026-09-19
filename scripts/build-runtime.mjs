import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
// Keep workspace package specifiers; Node resolves their compiled exports.
// Relative TS imports are bundled, so runtime needs neither src/ nor a TS loader.
for (const [name, entries] of [
  ['contracts', ['index', 'schemas']],
  ['game-core', ['index']],
  ['server', ['index']],
]) {
  await build({
    absWorkingDir: root,
    entryPoints: entries.map((entry) => `packages/${name}/src/${entry}.ts`),
    outdir: resolve(root, 'packages', name, 'dist'),
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    logLevel: 'info',
  });
}
