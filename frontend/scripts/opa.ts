import { spawnSync } from 'node:child_process';

/** The OPA binary: an explicit path, `OPA_BIN`, or `opa` on `PATH`. */
export function locateOpa(explicit?: string): string | null {
  if (explicit) return explicit;
  if (process.env.OPA_BIN) return process.env.OPA_BIN;
  const which = spawnSync('which', ['opa'], { encoding: 'utf8' });
  if (which.status === 0) {
    const found = which.stdout.trim();
    if (found) return found;
  }
  return null;
}
