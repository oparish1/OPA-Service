import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './core/App';
import { setApiMode } from './core/api';
import { handleRedirect } from './core/api/real';
import { ConfigurationError } from './core/components/ConfigurationError';
import { ErrorBoundary } from './core/components/ErrorBoundary';
import { StartupError } from './core/components/StartupError';
import { loadAppConfig } from './core/config';
import { installGlobalHandlers } from './core/lib/global-handlers';
import { defaultLogLevel, describeError, installLogBuffer, log, setLogLevel } from './core/lib/log';
import { setProviderRegistry } from './core/providers/active';
import './core/styles/global.css';
import { color, focus, font } from './core/styles/tokens';
import { PROVIDER_MODULES } from './providers';

setProviderRegistry(PROVIDER_MODULES);
installLogBuffer(import.meta.env.DEV);
installGlobalHandlers();

const root = document.documentElement;
root.style.setProperty('--aa-focus', focus.color);
root.style.setProperty('--aa-focus-width', `${focus.width}px`);
root.style.setProperty('--aa-focus-offset', `${focus.offset}px`);
root.style.setProperty('--aa-font-body', font.body);
root.style.setProperty('--aa-text-primary', color.text.primary);
root.style.setProperty('--aa-bg-canvas', color.background.canvas);

/** The mock demo is opt-in and only exists in a development build. */
function mockRequested(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).get('mock') === '1';
}

async function start(): Promise<void> {
  const container = document.getElementById('root');
  if (!container) {
    log.error('startup', 'Root container missing');
    return;
  }
  const appRoot = createRoot(container);

  if (mockRequested()) {
    setApiMode('mock');
    appRoot.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    return;
  }

  const loaded = await loadAppConfig();
  if (loaded.status === 'error') {
    appRoot.render(
      <ConfigurationError
        reason={loaded.reason}
        message={loaded.message}
        reference={loaded.reference}
      />
    );
    return;
  }

  setLogLevel(loaded.config.logLevel ?? defaultLogLevel());
  setApiMode('real');

  const url = new URL(window.location.href);
  const outcome = await handleRedirect(url);
  if (outcome === 'handled') {
    window.history.replaceState({}, '', url.pathname);
  } else if (outcome === 'rejected') {
    window.history.replaceState({}, '', `${url.pathname}?error=signin`);
  }

  appRoot.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

void start().catch(error => {
  const reference = log.error('startup', 'Application failed to start', {
    error: describeError(error),
  });
  const container = document.getElementById('root');
  if (container) {
    createRoot(container).render(
      <StartupError message="The application could not start." reference={reference} />
    );
  }
});
