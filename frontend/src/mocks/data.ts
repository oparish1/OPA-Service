import type { Identity, ProviderConfig, Session } from './types';

export const PROFILE_ENDPOINT = 'https://api.agadv.example/v1/me';
export const PROJECTS_ENDPOINT = 'https://api.agadv.example/v1/projects';

/** Token value the demo treats as already expired, forcing the 401 recovery flow. */
export const EXPIRED_ACCESS_TOKEN = 'demo-access-token-expired';

export const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: 'microsoft',
    name: 'Microsoft Entra ID',
    icon: 'building-2',
    ssoDomain: 'agentic-advantage.example',
  },
  {
    id: 'okta',
    name: 'Okta',
    icon: 'circle-dot',
    ssoDomain: 'agentic-advantage.example',
  },
  {
    id: 'google',
    name: 'Google Workspace / Cloud Identity',
    icon: 'google',
    ssoDomain: 'agentic-advantage.example',
  },
];

export type ProviderId = (typeof PROVIDERS)[number]['id'];

/**
 * Providers enabled in this release: Entra ID only. The deferred providers stay in
 * the fixtures so the mock suite can keep exercising them, but no screen offers them.
 */
export const ENABLED_PROVIDER_IDS: readonly ProviderId[] = ['microsoft'];

export const ENABLED_PROVIDERS = PROVIDERS.filter(provider =>
  ENABLED_PROVIDER_IDS.some(id => id === provider.id)
);

export const IDENTITIES: readonly Identity[] = [
  {
    id: 'microsoft',
    name: 'Microsoft Entra ID',
    icon: 'building-2',
    subtitle: 'orlando.parish@agentic-advantage.example',
    status: 'primary',
    manageUrl: 'https://example.com/manage/microsoft',
  },
  {
    id: 'okta',
    name: 'Okta',
    icon: 'circle-dot',
    subtitle: 'orlando.parish@agentic-advantage.example',
    status: 'connected',
    manageUrl: 'https://example.com/manage/okta',
  },
  {
    id: 'sso',
    name: 'Organisation SSO',
    icon: 'building-2',
    subtitle: 'Organisation single sign-on',
    status: 'not-connected',
    manageUrl: 'https://example.com/manage/sso',
  },
  {
    id: 'google',
    name: 'Google Workspace / Cloud Identity',
    icon: 'google',
    subtitle: 'orlando.parish@agadv.example',
    status: 'not-connected',
    manageUrl: 'https://example.com/manage/google',
  },
];

export const ENABLED_IDENTITIES = IDENTITIES.filter(identity =>
  ENABLED_PROVIDER_IDS.some(id => id === identity.id)
);

export const MOCK_SESSION: Session = {
  provider: 'Google Workspace / Cloud Identity',
  account: {
    displayName: 'Orlando Parish',
    email: 'orlando.parish@agentic-advantage.example',
    organisation: 'Agentic Advantage',
    role: 'Developer',
    accountId: 'acct_demo_orlando_parish',
    createdAt: '10 Oct 2026 · 13:30:00 UTC',
  },
  accessToken: {
    masked: 'demo_at_op…9b4e',
    value: 'demo_at_op_20261010_orlando_parish_9b4e',
    expiresAt: '10 Oct 2026 · 14:30:00 UTC',
    scopes: 'profile.read · projects.read',
  },
  refreshToken: {
    masked: 'demo_rt_agadv…7c2f',
    value: 'demo_rt_agadv_20261011_orlando_parish_7c2f',
    expiresAt: '11 Oct 2026 · 13:30:00 UTC',
    grant: 'offline_access · rotating refresh token',
  },
  issuer: 'https://identity.agentic-advantage/example/entra',
  issuedAt: '10 Oct 2026 · 13:30:00 UTC',
  snapshot: '10 Oct 2026 · 14:12:00 UTC',
};

export const MOCK_PROFILE_BODY = {
  id: 'usr_demo_orlando',
  display_name: 'Orlando Parish',
  email: 'orlando.parish@agadv.example',
  organisation: 'Agentic Advantage',
  role: 'developer',
  permissions: ['profile.read', 'projects.read'],
};

export const MOCK_PROJECTS_BODY = {
  projects: [
    { id: 'prj_01', name: 'Atlas', status: 'active' },
    { id: 'prj_02', name: 'Beacon', status: 'active' },
    { id: 'prj_03', name: 'Cedar', status: 'archived' },
  ],
};

export const EMPTY_PROJECTS_BODY = { projects: [] };
