import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './core/App';
import { setProviderRegistry } from './core/providers/active';
import './core/styles/global.css';
import { color, focus, font } from './core/styles/tokens';
import { PROVIDER_MODULES } from './providers';

setProviderRegistry(PROVIDER_MODULES);

const root = document.documentElement;
root.style.setProperty('--aa-focus', focus.color);
root.style.setProperty('--aa-focus-width', `${focus.width}px`);
root.style.setProperty('--aa-focus-offset', `${focus.offset}px`);
root.style.setProperty('--aa-font-body', font.body);
root.style.setProperty('--aa-text-primary', color.text.primary);
root.style.setProperty('--aa-bg-canvas', color.background.canvas);

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
