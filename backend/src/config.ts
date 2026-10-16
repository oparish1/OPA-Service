import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform(value => value === 'true');

const baseSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
    ALLOWED_ORIGIN: z.string().url().optional(),
    DATABASE_URL: z.string().default(':memory:'),
    ALLOW_INSECURE_ISSUER: booleanString.optional(),
    ENTRA_TENANT_ID: z.string().min(1),
    ENTRA_ISSUER: z.string().url().optional(),
    ENTRA_CLIENT_ID: z.string().min(1),
    ENTRA_CLIENT_SECRET: z.string().min(1).optional(),
    ENTRA_CLIENT_PRIVATE_KEY: z.string().min(1).optional(),
    ENTRA_REQUIRED_APP_ROLE: z.string().min(1).default('Workspace.User'),
    ENTRA_API_CLIENT_ID: z.string().optional(),
    OKTA_ENABLED: booleanString.default(false),
    OKTA_ISSUER: z.string().url().optional(),
    OKTA_CLIENT_ID: z.string().min(1).optional(),
    OKTA_CLIENT_SECRET: z.string().min(1).optional(),
    OKTA_CLIENT_PRIVATE_KEY: z.string().min(1).optional(),
    OKTA_REQUIRED_GROUP: z.string().min(1).optional(),
    OKTA_API_AUDIENCE: z.string().min(1).optional(),
    GOOGLE_ENABLED: booleanString.default(false),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_HOSTED_DOMAIN: z.string().min(1).optional(),
    GOOGLE_PROMPT_CONSENT: booleanString.default(false),
    REQUEST_RUNNER_ALLOWED_HOSTS: z.string().optional(),
    SESSION_SECRET: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY_PREVIOUS: z.string().optional(),
    COOKIE_SECURE: booleanString.optional(),
    AUTH_ENABLED: booleanString.default(true),
    ENTRA_END_SESSION: booleanString.default(false),
    LOGIN_TX_TTL_SECONDS: z.coerce.number().int().positive().default(600),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    RATE_LIMIT_LOGIN: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_REFRESH: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_REVEAL: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_REQUEST_RUNNER: z.coerce.number().int().positive().default(20),
    LOG_LEVEL: z.string().default('info'),
  });

type ParsedEnv = z.infer<typeof baseSchema>;

const OKTA_REQUIRED_FIELDS = ['OKTA_ISSUER', 'OKTA_CLIENT_ID', 'OKTA_REQUIRED_GROUP', 'OKTA_API_AUDIENCE'] as const;
const GOOGLE_REQUIRED_FIELDS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_HOSTED_DOMAIN'] as const;

interface ProviderRequirement {
  readonly flag: 'OKTA_ENABLED' | 'GOOGLE_ENABLED';
  readonly path: string;
  readonly message: string;
  readonly present: (value: ParsedEnv) => boolean;
}

/** The single owner of which variables each enabled provider must supply. */
const PROVIDER_REQUIREMENTS: readonly ProviderRequirement[] = [
  ...OKTA_REQUIRED_FIELDS.map(field => ({
    flag: 'OKTA_ENABLED' as const,
    path: field,
    message: `${field} is required when Okta is enabled`,
    present: (value: ParsedEnv) => Boolean(value[field]),
  })),
  {
    flag: 'OKTA_ENABLED',
    path: 'OKTA_CLIENT_SECRET',
    message: 'an Okta client credential is required when Okta is enabled',
    present: value => Boolean(value.OKTA_CLIENT_SECRET || value.OKTA_CLIENT_PRIVATE_KEY),
  },
  ...GOOGLE_REQUIRED_FIELDS.map(field => ({
    flag: 'GOOGLE_ENABLED' as const,
    path: field,
    message: `${field} is required when Google is enabled`,
    present: (value: ParsedEnv) => Boolean(value[field]),
  })),
];

const schema = baseSchema
  .refine(config => config.ENTRA_CLIENT_SECRET || config.ENTRA_CLIENT_PRIVATE_KEY, {
    message: 'a client credential is required',
    path: ['ENTRA_CLIENT_SECRET'],
  })
  .refine(config => !(config.NODE_ENV === 'production' && config.DATABASE_URL === ':memory:'), {
    message: 'DATABASE_URL must point at a durable database in production',
    path: ['DATABASE_URL'],
  })
  .superRefine((value, ctx) => {
    for (const requirement of PROVIDER_REQUIREMENTS) {
      if (value[requirement.flag] && !requirement.present(value)) {
        ctx.addIssue({ code: 'custom', message: requirement.message, path: [requirement.path] });
      }
    }
  });

function isOktaConfigured(
  value: ParsedEnv
): value is ParsedEnv & Record<(typeof OKTA_REQUIRED_FIELDS)[number], string> {
  return OKTA_REQUIRED_FIELDS.every(field => Boolean(value[field]));
}

function isGoogleConfigured(
  value: ParsedEnv
): value is ParsedEnv & Record<(typeof GOOGLE_REQUIRED_FIELDS)[number], string> {
  return GOOGLE_REQUIRED_FIELDS.every(field => Boolean(value[field]));
}

export interface OktaProviderConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  clientPrivateKey?: string;
  requiredGroup: string;
  apiAudience: string;
}

export interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  hostedDomain: string;
  promptConsent: boolean;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  publicBaseUrl: string;
  allowedOrigin: string;
  databaseUrl: string;
  allowInsecureIssuer: boolean;
  tenantId: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
  clientPrivateKey?: string;
  requiredAppRole: string;
  apiClientId: string;
  okta?: OktaProviderConfig;
  google?: GoogleProviderConfig;
  requestRunnerAllowedHosts: readonly string[];
  sessionSecret: string;
  tokenEncryptionKey: string;
  tokenEncryptionKeyPrevious?: string;
  cookieSecure: boolean;
  authEnabled: boolean;
  entraEndSession: boolean;
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

/** Throws a message that names the missing variables but never echoes their values. */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const paths = [...new Set(parsed.error.issues.map(issue => issue.path.join('.')))]
      .filter(Boolean)
      .join(', ');
    throw new Error(`Invalid or missing configuration: ${paths || 'unknown'}`);
  }
  const value = parsed.data;
  const publicBaseUrl = value.PUBLIC_BASE_URL.replace(/\/$/, '');
  const okta =
    value.OKTA_ENABLED && isOktaConfigured(value)
      ? Object.freeze({
          issuer: value.OKTA_ISSUER,
          clientId: value.OKTA_CLIENT_ID,
          clientSecret: value.OKTA_CLIENT_SECRET,
          clientPrivateKey: value.OKTA_CLIENT_PRIVATE_KEY,
          requiredGroup: value.OKTA_REQUIRED_GROUP,
          apiAudience: value.OKTA_API_AUDIENCE,
        })
      : undefined;
  const google =
    value.GOOGLE_ENABLED && isGoogleConfigured(value)
      ? Object.freeze({
          clientId: value.GOOGLE_CLIENT_ID,
          clientSecret: value.GOOGLE_CLIENT_SECRET,
          hostedDomain: value.GOOGLE_HOSTED_DOMAIN,
          promptConsent: value.GOOGLE_PROMPT_CONSENT,
        })
      : undefined;
  return Object.freeze({
    nodeEnv: value.NODE_ENV,
    port: value.PORT,
    publicBaseUrl,
    allowedOrigin: value.ALLOWED_ORIGIN ?? publicBaseUrl,
    databaseUrl: value.DATABASE_URL,
    allowInsecureIssuer: value.ALLOW_INSECURE_ISSUER ?? value.NODE_ENV === 'test',
    tenantId: value.ENTRA_TENANT_ID,
    issuer:
      value.ENTRA_ISSUER ?? `https://login.microsoftonline.com/${value.ENTRA_TENANT_ID}/v2.0`,
    clientId: value.ENTRA_CLIENT_ID,
    clientSecret: value.ENTRA_CLIENT_SECRET,
    clientPrivateKey: value.ENTRA_CLIENT_PRIVATE_KEY,
    requiredAppRole: value.ENTRA_REQUIRED_APP_ROLE,
    apiClientId: value.ENTRA_API_CLIENT_ID ?? value.ENTRA_CLIENT_ID,
    okta,
    google,
    requestRunnerAllowedHosts: allowedHosts(publicBaseUrl, value.REQUEST_RUNNER_ALLOWED_HOSTS),
    sessionSecret: value.SESSION_SECRET,
    tokenEncryptionKey: value.TOKEN_ENCRYPTION_KEY,
    tokenEncryptionKeyPrevious: value.TOKEN_ENCRYPTION_KEY_PREVIOUS,
    cookieSecure: value.COOKIE_SECURE ?? value.NODE_ENV === 'production',
    authEnabled: value.AUTH_ENABLED,
    entraEndSession: value.ENTRA_END_SESSION,
    loginTransactionTtlSeconds: value.LOGIN_TX_TTL_SECONDS,
    auditRetentionDays: value.AUDIT_RETENTION_DAYS,
    rateLimitLogin: value.RATE_LIMIT_LOGIN,
    rateLimitRefresh: value.RATE_LIMIT_REFRESH,
    rateLimitReveal: value.RATE_LIMIT_REVEAL,
    rateLimitRequestRunner: value.RATE_LIMIT_REQUEST_RUNNER,
    logLevel: value.LOG_LEVEL,
  });
}
