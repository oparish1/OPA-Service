import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './core/App';
import { setApiMode, signOut } from './core/api';
import { setAppConfig } from './core/config';
import { setProviderRegistry } from './core/providers/active';
import { setOnExpire } from './core/session/store';
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

/**
 * Loads and validates the public config, then switches the API seam to the
 * provider-backed client. When the file is absent (the mock demo), the mock
 * seam stays active.
 */
async function start(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
    if (response.ok) {
      setAppConfig(await response.json());
      setApiMode('real');
      setOnExpire(() => {
        void signOut();
      });
      const url = new URL(window.location.href);
      for (const module of PROVIDER_MODULES) {
        if (await module.auth?.handleRedirect(url)) {
          window.history.replaceState({}, '', url.pathname);
          break;
        }
      }
    }
  } catch {
    // No usable config: keep the mock seam so the demo still renders.
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('Root container missing');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void start();
