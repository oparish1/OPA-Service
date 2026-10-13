import { Button } from './Button';
import { TextLink } from './TextLink';
import { Notice } from './Notice';
import { body, color, font, space } from '../styles/tokens';

interface RecoveryResponseProps {
  expiredAt: string;
  refreshValidUntil: string;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onSignIn: () => void;
}

/** Local composition: expired-token recovery panel, rendered inside Notice tone=error. */
export function RecoveryResponse({
  expiredAt,
  refreshValidUntil,
  refreshing,
  error,
  onRefresh,
  onSignIn,
}: RecoveryResponseProps) {
  return (
    <Notice tone="error" heading="Access token expired. Your account is still connected.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
        <span>
          Expired {expiredAt}. Your refresh token is valid until {refreshValidUntil}.
        </span>
        {error ? (
          <span role="alert" style={{ ...body[14], fontFamily: font.body, color: color.status.error }}>
            {error}
          </span>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: space[20] }}>
          <Button state={refreshing ? 'in-progress' : 'default'} onClick={onRefresh}>
            Refresh token &amp; retry
          </Button>
          <TextLink onClick={onSignIn}>Sign in again</TextLink>
        </div>
        <span>
          Get a new access token, then retry this GET request. If refresh fails, sign in again.
        </span>
      </div>
    </Notice>
  );
}
