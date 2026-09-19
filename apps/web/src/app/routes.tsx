import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { EntryPage } from './EntryPage';
import { JoinPage } from './JoinPage';
import { NotFoundPage } from './NotFoundPage';
import { RoomPage } from './RoomPage';
import { RootErrorBoundary } from './RootErrorBoundary';
import { DEV_TOOLS } from '../devTools';

/** Geliştirme girişleri yalnız `import.meta.env.DEV` iken derlemeye girer. */
const devRoutes: RouteObject[] = DEV_TOOLS
  ? [
      {
        path: '/dev/scene',
        lazy: async () => {
          const module = await import('../dev/DevScenePage');
          return { Component: module.DevScenePage };
        },
      },
      {
        // D3 karakter galerisi (8 karakter / ifade / ten) — oyun verisi yok.
        path: '/dev/characters',
        lazy: async () => {
          const module = await import('../dev/DevCharactersPage');
          return { Component: module.DevCharactersPage };
        },
      },
      {
        // D1 el inceleme görünümü (kavrama × açı) — oyun verisi yok.
        path: '/dev/hands',
        lazy: async () => {
          const module = await import('../dev/DevHandsPage');
          return { Component: module.DevHandsPage };
        },
      },
      {
        // Tam ekran oyun ekranı düzenini sentetik fixture ile açar (ağ yok).
        path: '/dev/game',
        lazy: async () => {
          const module = await import('../dev/DevGamePage');
          return { Component: module.DevGamePage };
        },
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    errorElement: <RootErrorBoundary />,
    children: [
      { path: '/', element: <EntryPage /> },
      { path: '/katil/:code', element: <JoinPage /> },
      { path: '/oda/:roomId', element: <RoomPage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
