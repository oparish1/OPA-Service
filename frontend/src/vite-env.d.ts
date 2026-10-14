/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_MODE?: 'mock' | 'entra';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
