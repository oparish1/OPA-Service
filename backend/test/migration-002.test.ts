import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'bun:test';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { MIGRATIONS, Store } from '../src/db';
import { testEnv } from './helpers/harness';
import { TestIdp } from './helpers/idp';

const idp = new TestIdp({ tenantId: 'tenant-1', clientId: 'client-1' });
await idp.start();

const tempDirs: string[] = [];
const openStores: Store[] = [];

afterEach(() => {
  for (const store of openStores.splice(0)) store.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

afterAll(() => idp.stop());

interface Seeds {
  userId: string;
  sessionId: string;
  oid: string;
  tid: string;
}

/** Builds a database at schema 001 with one Entra user, session and token. */
function seedLegacyDatabase(): { path: string; seeds: Seeds } {
  const dir = mkdtempSync(join(tmpdir(), 'archon-migration-'));
  tempDirs.push(dir);
  const path = join(dir, 'store.db');
  const seeds: Seeds = { userId: 'legacy-user-1', sessionId: 'legacy-session-1', oid: 'oid-1', tid: 'tenant-1' };

  const db = new Database(path);
  for (const statement of MIGRATIONS[0].statements) db.exec(statement);
  db.exec('CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
  db.query("INSERT INTO schema_migrations (version, applied_at) VALUES ('001', ?)").run(Date.now());
  const now = Date.now();
  db.query(
    'INSERT INTO users (id, tid, oid, email, display_name, organisation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(seeds.userId, seeds.tid, seeds.oid, 'legacy@example.test', 'Legacy User', 'AA', now);
  db.query(
    'INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
  ).run(seeds.sessionId, seeds.userId, 'legacy-csrf', now, now);
  db.query(
    `INSERT INTO tokens (session_id, access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at, scopes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(seeds.sessionId, 'sealed-access', 'sealed-refresh', now + 3600_000, now + 90 * 24 * 3600_000, 'openid');
  db.close();
  return { path, seeds };
}

describe('migration 002 on a seeded Entra database (B9)', () => {
  it('keeps user ids, sessions and tokens and keeps the previous release working', async () => {
    const { path, seeds } = seedLegacyDatabase();
    const config = loadConfig(testEnv({ ENTRA_ISSUER: idp.origin, DATABASE_URL: path }));
    const store = new Store(path);
    openStores.push(store);
    store.migrate();

    // The row is unchanged and reachable through the legacy and new lookups.
    const legacy = store.getUserByTidOid(seeds.tid, seeds.oid);
    expect(legacy?.id).toBe(seeds.userId);
    expect(store.getUserByIdentity('entra', config.issuer, seeds.oid)?.id).toBe(seeds.userId);
    expect(store.getTokens(seeds.sessionId)).not.toBeNull();

    // The live session still authenticates and /v1/me returns the same body.
    const { app } = await buildApp({ config, store });
    const cookie = app.signCookie(seeds.sessionId);
    const me = await app.inject({ method: 'GET', url: '/v1/me', cookies: { aa_session: cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: `usr_${seeds.oid}`, display_name: 'Legacy User' });
    await app.close();
  });

  it('reuses the migrated row on the first new sign-in and backfills the issuer', () => {
    const { path, seeds } = seedLegacyDatabase();
    const config = loadConfig(testEnv({ ENTRA_ISSUER: idp.origin, DATABASE_URL: path }));
    const store = new Store(path);
    openStores.push(store);
    store.migrate();

    const updated = store.upsertUserByIdentity(
      { provider: 'entra', issuer: config.issuer, subject: seeds.oid },
      {
        tid: seeds.tid,
        oid: seeds.oid,
        email: 'changed@example.test',
        displayName: 'Changed User',
        organisation: 'AA',
      }
    );
    expect(updated.id).toBe(seeds.userId);
    expect(updated.issuer).toBe(config.issuer);
    expect(updated.email).toBe('changed@example.test');
    expect(store.countUsers()).toBe(1);
  });

  it('reuses a row the previous release inserted after migration, before its first new sign-in', () => {
    const { path, seeds } = seedLegacyDatabase();
    const config = loadConfig(testEnv({ ENTRA_ISSUER: idp.origin, DATABASE_URL: path }));
    const store = new Store(path);
    openStores.push(store);
    store.migrate();

    // The previous release's INSERT omits provider/issuer/subject, so subject stays NULL.
    const legacy = new Database(path);
    legacy
      .query(
        'INSERT INTO users (id, tid, oid, email, display_name, organisation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run('legacy-user-2', seeds.tid, 'oid-2', 'second@example.test', 'Second User', 'AA', Date.now());
    legacy.close();

    const reused = store.upsertUserByIdentity(
      { provider: 'entra', issuer: config.issuer, subject: 'oid-2' },
      {
        tid: seeds.tid,
        oid: 'oid-2',
        email: 'second@example.test',
        displayName: 'Second User',
        organisation: 'AA',
      }
    );
    expect(reused.id).toBe('legacy-user-2');
    expect(reused.issuer).toBe(config.issuer);
    expect(reused.subject).toBe('oid-2');
    expect(store.countUsers()).toBe(2);
  });
});
