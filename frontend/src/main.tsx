import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './core/App';
import { setApiMode } from './core/api';
import { handleRedirect } from './core/api/real';
import { setAppConfig } from './core/config';
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

/**
 * Loads and validates the public config. Returns false only when no config file
 * is served (the mock demo); a served-but-invalid config throws so `start`
 * surfaces it instead of silently mocking.
 */
async function loadConfig(): Promise<boolean> {
  const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`config.json returned ${response.status}`);

  let raw: unknown;
  try {
    raw = JSON.parse(await response.text());
  } catch {
    // A static host that has no config file may answer with the SPA index.html.
    return false;
  }
  setAppConfig(raw);
  return true;
}

async function start(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) throw new Error('Root container missing');

  let configured: boolean;
  try {
    configured = await loadConfig();
  } catch (error) {
    container.textContent =
      error instanceof Error ? `Configuration error: ${error.message}` : 'Configuration error';
    return;
  }

  if (configured) {
    setApiMode('real');
    const url = new URL(window.location.href);
    const outcome = await handleRedirect(url);
    if (outcome === 'handled') {
      window.history.replaceState({}, '', url.pathname);
    } else if (outcome === 'rejected') {
      window.history.replaceState({}, '', `${url.pathname}?error=signin`);
    }
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void start();
