import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { vercelApiDev } from './vite/apiPlugin';

/** `.env` deposu kökten okunur; `VITE_` önekli değişkenler tarayıcıya girer. */
const envDir = fileURLToPath(new URL('../../', import.meta.url));
const apiDir = fileURLToPath(new URL('./api', import.meta.url));

export default defineConfig({
  envDir,
  /** D23 — jsdom `en-US` bildirir; testler kaynak dilde (tr) koşsun. */
  test: {
    setupFiles: [fileURLToPath(new URL('./test/setup.ts', import.meta.url))],
  },
  plugins: [react(), vercelApiDev({ apiDir, envDir })],
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * ROADMAP §C/2 — sahne kod bölmesi.
         *
         * Asıl bölme `SceneFrame` içindeki `import('@secret-table/scene')`
         * ile olur; giriş paketi three/R3F taşımaz. Burada yalnız o tembel
         * grafiği ikiye ayırıyoruz ki `three` kendi uzun ömürlü önbellek
         * birimi olsun.
         *
         * `react`/`react-dom`/`react-router` AÇIKÇA kendi chunk'ına
         * sabitlenir: aksi halde Rollup bu paylaşılan modülleri `three`
         * chunk'ına eritir ve giriş sayfası sahne ağırlığını statik olarak
         * çeker (ölçüldü: giriş → 362 kB'lık react-three chunk'ı statik
         * import ediyordu).
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id))
            return 'react-vendor';
          if (/node_modules\/three\//.test(id)) return 'three';
          return undefined;
        },
      },
    },
  },
});
