/// <reference types="vite/client" />

// `shared/provider-isolation.ts` and the repository acceptance test read the
// repo with Node built-ins; the frontend program has no `@types/node`, so the
// small surface they use is declared here rather than pulling a dependency in.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean; isFile(): boolean };
  export function existsSync(path: string): boolean;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function relative(from: string, to: string): string;
  export const sep: string;
}
