import React from 'react';
import { createRoot } from 'react-dom/client';
import FirstPersonPrototype from '../prototype/FirstPersonPrototype';
// Independent DEV page; no production route or public package export.
const root = createRoot(document.getElementById('root'));
root.render(<FirstPersonPrototype />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
