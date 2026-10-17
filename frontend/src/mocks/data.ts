import { providerIcon } from '../lib/provider-icons';
import type { ProviderId, ProviderLinks } from '../../../shared/providers';
import type { Identity, ProviderConfig, ProviderInfo, Session } from './types';

export type { ProviderId };

/** Enabled providers, in the order the sign-in screen renders them. */
export const PROVIDERS: readonly ProviderConfig[] = [
  {
    id: 'entra',
    name: 'Microsoft Entra ID',
    ssoDomain: 'agentic-advantage.example',
  },
  {
    id: 'okta',
    name: 'Okta',
    ssoDomain: 'agentic-advantage.example',
  },
  {
    id: 'google',
    name: 'Google Workspace / Cloud Identity',
    ssoDomain: 'agentic-advantage.example',
  },
];

/** Per-provider account destinations; a link is hidden when its value is unset. */
export const PROVIDER_LINKS: Record<ProviderId, ProviderLinks> = {
  entra: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/entra',
  },
  okta: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/okta',
  },
  google: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/google',
  },
};

/** The mock's `GET /auth/providers` response. */
export function providerInfos(): ProviderInfo[] {
  return PROVIDERS.map(provider => ({
    id: provider.id,
    name: provider.name,
    ...PROVIDER_LINKS[provider.id],
  }));
}

export function identityFor(providerId: ProviderId, email: string): Identity {
  const provider = PROVIDERS.find(candidate => candidate.id === providerId) ?? PROVIDERS[0];
  return {
    id: provider.id,
    name: provider.name,
    icon: providerIcon(provider.id),
    subtitle: email,
    status: 'primary',
    manageUrl: PROVIDER_LINKS[provider.id].manageAccountUrl,
  };
}

export const MOCK_SESSION: Session = {
  provider: 'Microsoft Entra ID',
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