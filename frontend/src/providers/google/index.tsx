import type { ProviderId } from '../../../../shared/providers';
import type { FrontendProviderModule } from '../../core/providers/types';
import { GoogleIcon } from './icon';

export const googleModule: FrontendProviderModule = {
  id: 'google' satisfies ProviderId,
  name: 'Google Workspace / Cloud Identity',
  ssoDomain: 'agentic-advantage.example',
  links: {
    forgotPasswordUrl: 'https://example.com/reset',
    changePasswordUrl: 'https://example.com/change',
    manageAccountUrl: 'https://example.com/manage/google',
  },
  renderIcon: size => <GoogleIcon size={size} />,
};
