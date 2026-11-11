import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * OPA cannot load an unsigned bundle once a verification key is set, and the
 * production signing key is not available to the local stack. The stack
 * re-signs the verified published bundle to add the decision-log mask, so this
 * generates the throwaway P-256 pair for that one re-signature; the published
 * artifact is still verified against the committed production public key.
 */
export function generateBundleKey(privatePath: string, publicPath: string): void {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  mkdirSync(dirname(privatePath), { recursive: true });
  mkdirSync(dirname(publicPath), { recursive: true });
  writeFileSync(privatePath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  writeFileSync(publicPath, publicKey.export({ type: 'spki', format: 'pem' }));
}

if (import.meta.main) {
  const [privatePath = '/ephemeral/ephemeral.pem', publicPath = '/ephemeral/ephemeral.pub'] =
    process.argv.slice(2);
  generateBundleKey(privatePath, publicPath);
}
