import { CircleDot } from 'lucide-react';
import type { FrontendProviderModule } from '../../core/providers/types';

export const oktaModule: FrontendProviderModule = {
  id: 'okta',
  name: 'Okta',
  ssoDomain: 'agentic-advantage.example',
  links: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/okta',
  },
  renderIcon: size => <CircleDot size={size} aria-hidden />,
};
