import { afterEach, describe, expect, it } from 'bun:test';
import { AuditLogger } from '../src/core/audit';
import { TokenCipher } from '../src/core/crypto';
import { Store } from '../src/core/db';

const keyA = Buffer.alloc(32, 1).toString('base64');
const keyB = Buffer.alloc(32, 2).toString('base64');

const openStores: Store[] = [];

function store(): Store {
  const created = new Store(':memory:');
  created.migrate();
  openStores.push(created);
  return created;
}

afterEach(() => {
  for (const created of openStores.splice(0)) created.close();
});

describe('Store migrations', () => {
  it('applies migrations idempotently', () => {
    const db = store();
    db.migrate();
    expect(db.countUsers()).toBe(0);
  });

  it('reuses the row for one identity and separates distinct subjects', () => {
    const db = store();
    const identity = { provider: 'test', issuer: 'https://issuer.example', subject: 'subject-1' };
    const profile = { email: 'a@x', displayName: 'A', organisation: 'AA' };
    const first = db.upsertUserByIdentity(identity, profile);
    const second = db.upsertUserByIdentity(identity, {
      ...profile,
      email: 'b@x',
      displayName: 'B',
    });
    expect(second.id).toBe(first.id);
    expect(second.email).toBe('b@x');
    expect(db.countUsers()).toBe(1);

    db.upsertUserByIdentity({ ...identity, subject: 'subject-2' }, profile);
    expect(db.countUsers()).toBe(2);
  });
});

describe('login transaction cleanup', () => {
  it('purges only expired transactions and leaves live ones consumable', () => {
    const db = store();
    const now = Date.now();
    const transaction = (state: string, expiresAt: number) => ({
      state,
      cookieHash: 'hash',
      nonce: 'nonce',
      codeVerifierEnc: 'sealed',
      returnTo: '/',
      createdAt: now,
      expiresAt,
    });
    db.createLoginTransaction(transaction('expired', now - 1));
    db.createLoginTransaction(transaction('live', now + 60_000));

    expect(db.purgeExpiredLoginTransactions(now)).toBe(1);
    expect(db.consumeLoginTransaction('expired')).toBeNull();
    expect(db.consumeLoginTransaction('live')).toBeTruthy();
  });
});

describe('TokenCipher', () => {
  it('seals and opens with the current key', () => {
    const cipher = new TokenCipher(keyA);
    const sealed = cipher.seal('real-token-value');
    expect(sealed).not.toContain('real-token-value');
    expect(cipher.open(sealed)).toBe('real-token-value');
  });

  it('opens ciphertext sealed with a previous key after rotation', () => {
    const sealedWithOld = new TokenCipher(keyA).seal('rotated-secret');
    const rotated = new TokenCipher(keyB, keyA);
    expect(rotated.open(sealedWithOld)).toBe('rotated-secret');
  });

  it('rejects a key that is not 32 bytes', () => {
    expect(() => new TokenCipher('short')).toThrow(/32-byte/);
  });
});

describe('audit retention', () => {
  it('purges only rows older than the retention window', () => {
    const db = store();
    const audit = new AuditLogger(db);
    const now = Date.now();
    db.insertAudit({
      actorOid: 'o1',
      actorTid: 't1',
      sessionHash: null,
      event: 'login.success',
      outcome: 'success',
      reason: null,
      ip: '127.0.0.1',
      userAgent: 'agent',
      createdAt: now - 91 * 24 * 60 * 60 * 1000,
      metadata: null,
    });
    db.insertAudit({
      actorOid: 'o2',
      actorTid: 't1',
      sessionHash: null,
      event: 'login.success',
      outcome: 'success',
      reason: null,
      ip: '127.0.0.1',
      userAgent: 'agent',
      createdAt: now,
      metadata: null,
    });
    expect(audit.purge(90, now)).toBe(1);
    expect(db.listAuditEvents()).toHaveLength(1);
  });
});
