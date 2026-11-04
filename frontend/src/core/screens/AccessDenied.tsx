import { useApp } from '../app/app-context';
import { Notice } from '../components/Notice';
import { TextLink } from '../components/TextLink';
import { WorkspaceLayout } from '../layouts/WorkspaceLayout';
import type { Screen } from '../mocks/types';

interface AccessDeniedProps {
  screen: Screen;
}

/** Shown when a denied route is opened directly; the gateway still refuses it. */
export function AccessDenied({ screen }: AccessDeniedProps) {
  const { navigate } = useApp();
  return (
    <WorkspaceLayout active={screen} breadcrumb="WORKSPACE" title="Access denied">
      <Notice tone="error" heading="You don't have access to this page">
        Your account does not have permission for this area. If you believe this is wrong, contact your
        administrator.
      </Notice>
      <TextLink onClick={() => navigate('overview')}>Back to overview</TextLink>
    </WorkspaceLayout>
  );
}
