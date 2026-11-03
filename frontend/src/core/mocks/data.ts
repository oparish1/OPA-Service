import { getProviderRegistry } from '../providers/active';
import type { Session } from './types';

/** The demo account, shared by the demo session and the workspace header. */
const MOCK_ACCOUNT: NonNullable<Session['account']> = {
  displayName: 'Demo User',
  email: 'demo.user@agentic-advantage.example',
  organisation: 'Demo Organisation',
  role: 'DemoDeveloper',
  accountId: 'acct_demo_demo_user',
  createdAt: '10 Oct 2026 · 13:30:00 UTC',
};

/** The demo session for the provider the active registry reports first. */
export function mockSession(): Session {
  const provider = getProviderRegistry().all[0];
  return {
    provider: provider?.name ?? 'Test Provider',
    providerId: provider?.id ?? 'test',
    account: MOCK_ACCOUNT,
    accessToken: {
      masked: 'demo_at_op…9b4e',
      value: 'demo_at_op_20261010_demo_user_9b4e',
      expiresAt: '10 Oct 2026 · 14:30:00 UTC',
      scopes: 'workspace:read · workspace:write',
    },
    refreshToken: {
      masked: 'demo_rt_agadv…7c2f',
      value: 'demo_rt_agadv_20261011_orlando_parish_7c2f',
      expiresAt: '11 Oct 2026 · 13:30:00 UTC',
      grant: 'offline_access · rotating refresh token',
    },
    issuer: `https://identity.agentic-advantage/example/${provider?.id ?? 'test'}`,
    issuedAt: '10 Oct 2026 · 13:30:00 UTC',
    snapshot: '10 Oct 2026 · 14:12:00 UTC',
  };
}

export const MOCK_PROFILE_BODY = {
  id: 'usr_demo_user',
  display_name: 'Demo User',
  email: 'demo.user@agadv.example',
  organisation: 'Demo Organisation',
  role: 'DemoDeveloper',
  permissions: ['workspace:read', 'workspace:write'],
};

export const MOCK_PROJECTS_BODY = {
  projects: [
    { id: 'prj_01', name: 'Atlas', status: 'active' },
    { id: 'prj_02', name: 'Beacon', status: 'active' },
    { id: 'prj_03', name: 'Cedar', status: 'archived' },
  ],
};

export const EMPTY_PROJECTS_BODY = { projects: [] };