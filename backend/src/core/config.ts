import { z } from 'zod';
import { booleanString } from './provider';
import type { ProviderEnv, ProviderModule } from './provider';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGIN: z.string().url().optional(),
  DATABASE_URL: z.string().default(':memory:'),
  ALLOW_INSECURE_ISSUER: booleanString.optional(),
  REQUEST_RUNNER_ALLOWED_HOSTS: z.string().optional(),
  SESSION_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
  COOKIE_SECURE: booleanString.optional(),
  AUTH_ENABLED: booleanString.default(true),
  LOGIN_TX_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  RATE_LIMIT_LOGIN: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_REFRESH: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REVEAL: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_REQUEST_RUNNER: z.coerce.number().int().positive().default(20),
  LOG_LEVEL: z.string().default('info'),
});

type BaseEnv = z.infer<typeof baseSchema>;

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  publicBaseUrl: string;
  allowedOrigin: string;
  databaseUrl: string;
  allowInsecureIssuer: boolean;
  /** Each enabled provider's parsed, provider-owned configuration, keyed by module id. */
  providerConfigs: Record<string, unknown>;
  requestRunnerAllowedHosts: readonly string[];
  sessionSecret: string;
  tokenEncryptionKey: string;
  tokenEncryptionKeyPrevious?: string;
  cookieSecure: boolean;
  authEnabled: boolean;
  loginTransactionTtlSeconds: number;
  auditRetentionDays: number;
  rateLimitLogin: number;
  rateLimitRefresh: number;
  rateLimitReveal: number;
  rateLimitRequestRunner: number;
  logLevel: string;
}

function allowedHosts(publicBaseUrl: string, raw: string | undefined): readonly string[] {
  const hosts = new Set<string>([new URL(publicBaseUrl).host.toLowerCase()]);
  for (const entry of raw?.split(',') ?? []) {
    const host = entry.trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return Object.freeze([...hosts]);
}

/**
 * Builds the one schema from the base fields plus every module's own env shape,
 * so no provider variable is enumerated here. Production passes the registry's
 * modules; tests pass the neutral test provider so core stays provider-free.
 */
export function createConfig(
  env: Record<string, string | undefined>,
  modules: readonly ProviderModule[]
): AppConfig {
  const providerEnvShape: z.ZodRawShape = {};
  for (const module of modules) Object.assign(providerEnvShape, module.envShape);

  const schema = baseSchema
    .extend(providerEnvShape)
    .refine(config => !(config.NODE_ENV === 'production' && config.DATABASE_URL === ':memory:'), {
      message: 'DATABASE_URL must point at a durable database in production',
      path: ['DATABASE_URL'],
    });

  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const paths = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))]
      .filter(Boolean)
      .join(', ');
    throw new Error(`Invalid or missing configuration: ${paths || 'unknown'}`);
  }
  const value = parsed.data as BaseEnv & ProviderEnv;
  const publicBaseUrl = value.PUBLIC_BASE_URL.replace(/\/$/, '');

  const providerConfigs: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const module of modules) {
    if (!module.enabled(value)) continue;
    const requirements = module.requirements(value);
    if (requirements.length > 0) {
      missing.push(...requirements.map(requirement => requirement.path));
      continue;
    }
    providerConfigs[module.id] = module.parse(value);
  }
  if (missing.length > 0) {
    throw new Error(`Invalid or missing configuration: ${[...new Set(missing)].filter(Boolean).join(', ')}`);
  }

  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    publicBaseUrl,
    allowedOrigin: value.ALLOWED_ORIGIN ?? publicBaseUrl,
    databaseUrl: value.DATABASE_URL,
    allowInsecureIssuer: value.ALLOW_INSECURE_ISSUER ?? value.NODE_ENV === 'test',
    providerConfigs,
    requestRunnerAllowedHosts: allowedHosts(publicBaseUrl, value.REQUEST_RUNNER_ALLOWED_HOSTS),
    sessionSecret: value.SESSION_SECRET,
    tokenEncryptionKey: value.TOKEN_ENCRYPTION_KEY,
    tokenEncryptionKeyPrevious: value.TOKEN_ENCRYPTION_KEY_PREVIOUS,
    cookieSecure: value.COOKIE_SECURE ?? value.NODE_ENV === 'production',
    authEnabled: value.AUTH_ENABLED,
    loginTransactionTtlSeconds: value.LOGIN_TX_TTL_SECONDS,
    auditRetentionDays: value.AUDIT_RETENTION_DAYS,
    rateLimitLogin: value.RATE_LIMIT_LOGIN,
    rateLimitRefresh: value.RATE_LIMIT_REFRESH,
    rateLimitReveal: value.RATE_LIMIT_REVEAL,
    rateLimitRequestRunner: value.RATE_LIMIT_REQUEST_RUNNER,
    logLevel: value.LOG_LEVEL,
  });
}
