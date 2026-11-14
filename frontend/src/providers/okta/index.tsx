import { CircleDot } from 'lucide-react';
import type { ProviderId } from '../../../../shared/providers';
import type { FrontendProviderModule } from '../../core/providers/types';
import { createOktaAuth } from './auth';
import { oktaAuthzConfig, oktaClaims } from './claims';

export const oktaModule: FrontendProviderModule = {
  id: 'okta' satisfies ProviderId,
  name: 'Okta',
  ssoDomain: 'agentic-advantage.example',
  auth: createOktaAuth(),
  authz: { claims: oktaClaims, config: oktaAuthzConfig },
  links: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/okta',
  },
  renderIcon: size => <CircleDot size={size} aria-hidden />,
};
