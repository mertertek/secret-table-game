import React from 'react';
import { createRoot } from 'react-dom/client';
import Preview from './X03Preview';
// DEV-only entry used by docs/qa/codex/x03.html; deliberately outside public exports.
createRoot(document.getElementById('root')).render(<Preview />);
