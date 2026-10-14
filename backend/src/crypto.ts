import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;

interface KeyEntry {
  id: string;
  key: Buffer;
}

function decodeKey(value: string, name: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(`${name} must be a base64-encoded 32-byte key`);
  }
  return key;
}

function keyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

function toBase64Url(value: Buffer): string {
  return value.toString('base64url');
}

/**
 * AES-256-GCM envelope for tokens at rest. The key ring keeps the current key
 * plus one previous key so a rotation does not strand live sessions.
 */
export class TokenCipher {
  private readonly current: KeyEntry;
  private readonly keys: Map<string, Buffer>;

  constructor(currentKey: string, previousKey?: string) {
    const current = decodeKey(currentKey, 'TOKEN_ENCRYPTION_KEY');
    this.current = { id: keyId(current), key: current };
    this.keys = new Map([[this.current.id, current]]);
    if (previousKey) {
      const previous = decodeKey(previousKey, 'TOKEN_ENCRYPTION_KEY_PREVIOUS');
      this.keys.set(keyId(previous), previous);
    }
  }

  seal(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.current.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, this.current.id, toBase64Url(iv), toBase64Url(tag), toBase64Url(ciphertext)].join(
      '.'
    );
  }

  open(sealed: string): string {
    const [version, id, iv, tag, ciphertext] = sealed.split('.');
    if (version !== VERSION || !id || !iv || !tag || !ciphertext) {
      throw new Error('Unrecognised ciphertext');
    }
    const key = this.keys.get(id);
    if (!key) throw new Error('No key available for ciphertext');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
