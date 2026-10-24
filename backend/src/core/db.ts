import { Database } from 'bun:sqlite';

export interface UserRecord {
  id: string;
  provider: string;
  issuer: string | null;
  subject: string;
  tid: string;
  oid: string;
  email: string;
  displayName: string;
  organisation: string;
  createdAt: number;
}

/** The `(provider, issuer, subject)` key an account is stored under. */
export interface IdentityKey {
  provider: string;
  issuer: string;
  subject: string;
}

/** Provider-supplied profile fields; `tid`/`oid` are Entra-derived and absent elsewhere. */
export interface UserProfile {
  tid?: string;
  oid?: string;
  email: string;
  displayName: string;
  organisation: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface TokenRecord {
  sessionId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  scopes: string;
}

export interface LoginTransactionRecord {
  state: string;
  cookieHash: string;
  nonce: string;
  codeVerifierEnc: string;
  returnTo: string;
  provider?: string;
  createdAt: number;
  expiresAt: number;
}

export interface AuditRecord {
  actorOid: string | null;
  actorTid: string | null;
  actorProvider?: string | null;
  actorSubject?: string | null;
  sessionHash: string | null;
  event: string;
  outcome: string;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: number;
  metadata: string | null;
}

const USER_COLUMNS =
  "SELECT id, provider, issuer, COALESCE(subject, oid, '') AS subject, COALESCE(tid, '') AS tid, COALESCE(oid, '') AS oid, email, display_name AS displayName, organisation, created_at AS createdAt FROM users";
const SESSION_COLUMNS =
  'SELECT id, user_id AS userId, csrf_token AS csrfToken, created_at AS createdAt, last_seen_at AS lastSeenAt FROM sessions';
const TOKEN_COLUMNS =
  'SELECT session_id AS sessionId, access_token_enc AS accessTokenEnc, refresh_token_enc AS refreshTokenEnc, access_expires_at AS accessExpiresAt, refresh_expires_at AS refreshExpiresAt, scopes FROM tokens';
const LOGIN_TRANSACTION_COLUMNS =
  'state, cookie_hash AS cookieHash, nonce, code_verifier_enc AS codeVerifierEnc, return_to AS returnTo, provider, created_at AS createdAt, expires_at AS expiresAt';
const AUDIT_COLUMNS =
  'SELECT id, actor_oid AS actorOid, actor_tid AS actorTid, actor_provider AS actorProvider, actor_subject AS actorSubject, session_hash AS sessionHash, event, outcome, reason, ip, user_agent AS userAgent, created_at AS createdAt, metadata FROM audit_events';

export const MIGRATIONS: ReadonlyArray<{ version: string; statements: string[] }> = [
  {
    version: '001',
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tid TEXT NOT NULL,
        oid TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        organisation TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        UNIQUE (tid, oid)
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        csrf_token TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS tokens (
        session_id TEXT PRIMARY KEY,
        access_token_enc TEXT NOT NULL,
        refresh_token_enc TEXT NOT NULL,
        access_expires_at INTEGER NOT NULL,
        refresh_expires_at INTEGER NOT NULL,
        scopes TEXT NOT NULL DEFAULT ''
      )`,
      `CREATE TABLE IF NOT EXISTS login_transactions (
        state TEXT PRIMARY KEY,
        cookie_hash TEXT NOT NULL,
        nonce TEXT NOT NULL,
        code_verifier_enc TEXT NOT NULL,
        return_to TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_oid TEXT,
        actor_tid TEXT,
        session_hash TEXT,
        event TEXT NOT NULL,
        outcome TEXT NOT NULL,
        reason TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL,
        metadata TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events (created_at)`,
    ],
  },
  {
    version: '002',
    statements: [
      // SQLite cannot relax the NOT NULL on tid/oid in place, so the table is
      // rebuilt. Existing rows keep their id and are backfilled as Entra.
      `CREATE TABLE users_rebuilt (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'entra',
        issuer TEXT,
        subject TEXT,
        tid TEXT,
        oid TEXT,
        email TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        organisation TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      )`,
      `INSERT INTO users_rebuilt (id, provider, issuer, subject, tid, oid, email, display_name, organisation, created_at)
       SELECT id, 'entra', NULL, oid, tid, oid, email, display_name, organisation, created_at FROM users`,
      `DROP TABLE users`,
      `ALTER TABLE users_rebuilt RENAME TO users`,
      `CREATE UNIQUE INDEX ux_users_identity ON users (provider, issuer, subject)`,
      `CREATE UNIQUE INDEX ux_users_tid_oid ON users (tid, oid)`,
      `ALTER TABLE login_transactions ADD COLUMN provider TEXT NOT NULL DEFAULT 'entra'`,
      `ALTER TABLE audit_events ADD COLUMN actor_provider TEXT`,
      `ALTER TABLE audit_events ADD COLUMN actor_subject TEXT`,
    ],
  },
];

export class Store {
  private readonly db: Database;

  constructor(databaseUrl: string) {
    this.db = new Database(databaseUrl === ':memory:' ? ':memory:' : databaseUrl);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  /** Applies each migration once, recorded in `schema_migrations`. */
  migrate(): void {
    this.db.exec(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)'
    );
    const applied = new Set(
      this.db.query<{ version: string }, []>('SELECT version FROM schema_migrations').all().map(row => row.version)
    );
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      const run = this.db.transaction(() => {
        for (const statement of migration.statements) this.db.exec(statement);
        this.db
          .query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
          .run(migration.version, Date.now());
      });
      run();
    }
  }

  close(): void {
    this.db.close();
  }

  getUserByTidOid(tid: string, oid: string): UserRecord | null {
    return (
      this.db
        .query<UserRecord, [string, string]>(`${USER_COLUMNS} WHERE tid = ? AND oid = ?`)
        .get(tid, oid) ?? null
    );
  }

  /** Exact `(provider, issuer, subject)` lookup; a provider may add its own legacy matches. */
  getUserByIdentity(provider: string, issuer: string, subject: string): UserRecord | null {
    return (
      this.db
        .query<UserRecord, [string, string, string]>(
          `${USER_COLUMNS} WHERE provider = ? AND issuer = ? AND subject = ?`
        )
        .get(provider, issuer, subject) ?? null
    );
  }

  /** Matches by provider and subject regardless of issuer; legacy Entra rows use this. */
  getUserByProviderSubject(provider: string, subject: string): UserRecord | null {
    return (
      this.db
        .query<UserRecord, [string, string]>(`${USER_COLUMNS} WHERE provider = ? AND subject = ?`)
        .get(provider, subject) ?? null
    );
  }

  /** Matches a migrated row whose subject is NULL, by provider and oid. */
  getUserByProviderOidWithoutSubject(provider: string, oid: string): UserRecord | null {
    return (
      this.db
        .query<UserRecord, [string, string]>(
          `${USER_COLUMNS} WHERE provider = ? AND subject IS NULL AND oid = ?`
        )
        .get(provider, oid) ?? null
    );
  }

  /** Creates or updates the row for a `(provider, issuer, subject)` identity. */
  upsertUserByIdentity(
    identity: IdentityKey,
    profile: UserProfile,
    matched?: UserRecord | null
  ): UserRecord {
    const existing =
      matched ?? this.getUserByIdentity(identity.provider, identity.issuer, identity.subject);
    const tid = profile.tid ?? null;
    const oid = profile.oid ?? null;
    if (existing) {
      this.db
        .query(
          `UPDATE users SET provider = ?, issuer = ?, subject = ?, tid = ?, oid = ?,
           email = ?, display_name = ?, organisation = ? WHERE id = ?`
        )
        .run(
          identity.provider,
          identity.issuer,
          identity.subject,
          tid,
          oid,
          profile.email,
          profile.displayName,
          profile.organisation,
          existing.id
        );
      return this.getUserById(existing.id) ?? existing;
    }
    const record: UserRecord = {
      id: crypto.randomUUID(),
      provider: identity.provider,
      issuer: identity.issuer,
      subject: identity.subject,
      tid: tid ?? '',
      oid: oid ?? '',
      email: profile.email,
      displayName: profile.displayName,
      organisation: profile.organisation,
      createdAt: Date.now(),
    };
    this.db
      .query(
        `INSERT INTO users (id, provider, issuer, subject, tid, oid, email, display_name, organisation, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.id,
        record.provider,
        record.issuer,
        record.subject,
        tid,
        oid,
        record.email,
        record.displayName,
        record.organisation,
        record.createdAt
      );
    return record;
  }

  getUserById(id: string): UserRecord | null {
    return (
      this.db
        .query<UserRecord, [string]>(`${USER_COLUMNS} WHERE id = ?`)
        .get(id) ?? null
    );
  }

  countUsers(): number {
    return this.db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM users').get()?.count ?? 0;
  }

  createSession(record: SessionRecord): void {
    this.db
      .query(
        'INSERT INTO sessions (id, user_id, csrf_token, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(record.id, record.userId, record.csrfToken, record.createdAt, record.lastSeenAt);
  }

  getSession(id: string): SessionRecord | null {
    return (
      this.db
        .query<SessionRecord, [string]>(`${SESSION_COLUMNS} WHERE id = ?`)
        .get(id) ?? null
    );
  }

  touchSession(id: string, lastSeenAt: number): void {
    this.db.query('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(lastSeenAt, id);
  }

  deleteSession(id: string): void {
    this.db.query('DELETE FROM sessions WHERE id = ?').run(id);
    this.db.query('DELETE FROM tokens WHERE session_id = ?').run(id);
  }

  saveTokens(record: TokenRecord): void {
    this.db
      .query(
        `INSERT INTO tokens (session_id, access_token_enc, refresh_token_enc, access_expires_at, refresh_expires_at, scopes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           access_token_enc = excluded.access_token_enc,
           refresh_token_enc = excluded.refresh_token_enc,
           access_expires_at = excluded.access_expires_at,
           refresh_expires_at = excluded.refresh_expires_at,
           scopes = excluded.scopes`
      )
      .run(
        record.sessionId,
        record.accessTokenEnc,
        record.refreshTokenEnc,
        record.accessExpiresAt,
        record.refreshExpiresAt,
        record.scopes
      );
  }

  getTokens(sessionId: string): TokenRecord | null {
    return (
      this.db
        .query<TokenRecord, [string]>(`${TOKEN_COLUMNS} WHERE session_id = ?`)
        .get(sessionId) ?? null
    );
  }

  createLoginTransaction(record: LoginTransactionRecord): void {
    this.db
      .query(
        `INSERT INTO login_transactions (state, cookie_hash, nonce, code_verifier_enc, return_to, provider, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.state,
        record.cookieHash,
        record.nonce,
        record.codeVerifierEnc,
        record.returnTo,
        record.provider ?? '',
        record.createdAt,
        record.expiresAt
      );
  }

  /** Single-use consumption: returns the row and deletes it atomically. */
  consumeLoginTransaction(state: string): LoginTransactionRecord | null {
    return this.db
      .query<LoginTransactionRecord, [string]>(
        `DELETE FROM login_transactions WHERE state = ? RETURNING ${LOGIN_TRANSACTION_COLUMNS}`
      )
      .get(state);
  }

  purgeExpiredLoginTransactions(now: number): number {
    return this.db.query('DELETE FROM login_transactions WHERE expires_at < ?').run(now).changes;
  }

  insertAudit(record: AuditRecord): void {
    this.db
      .query(
        `INSERT INTO audit_events (actor_oid, actor_tid, actor_provider, actor_subject, session_hash, event, outcome, reason, ip, user_agent, created_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.actorOid,
        record.actorTid,
        record.actorProvider ?? null,
        record.actorSubject ?? null,
        record.sessionHash,
        record.event,
        record.outcome,
        record.reason,
        record.ip,
        record.userAgent,
        record.createdAt,
        record.metadata
      );
  }

  listAuditEvents(): AuditRecord[] {
    return this.db
      .query<AuditRecord, []>(`${AUDIT_COLUMNS} ORDER BY id ASC`)
      .all();
  }

  purgeAudit(before: number): number {
    return this.db.query('DELETE FROM audit_events WHERE created_at < ?').run(before).changes;
  }
}
