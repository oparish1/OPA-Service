// Injected at build time via `define` in vite.config.ts.
declare const __APP_VERSION__: string;

/**
 * Public, non-secret configuration. Everything VITE_* is bundled into the
 * browser build, so never put client secrets, API keys or tokens here.
 */
export const appConfig = {
  workspaceName: import.meta.env.VITE_WORKSPACE_NAME ?? 'Workspace',
  environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
  isDemo: import.meta.env.VITE_DEMO_MODE === 'true',
  docsUrl: import.meta.env.VITE_DOCS_URL as string | undefined,
  version: typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__,
} as const;