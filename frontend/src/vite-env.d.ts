/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_MODE?: 'mock' | 'entra';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// `shared/provider-isolation.ts` is shared with the backend and reads the repo
// with Node built-ins; the frontend program has no `@types/node`, so the small
// surface it uses is declared here rather than pulling a new dependency in.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
  export const sep: string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
