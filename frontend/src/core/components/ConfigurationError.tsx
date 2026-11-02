import { body, color, font, space } from '../styles/tokens';
import { FatalNotice } from './FatalNotice';
import { Notice } from './Notice';

interface ConfigurationErrorProps {
  reason: string;
  message: string;
  reference: string;
}

/** The screen a bad or missing public config shows instead of starting the mock demo. */
export function ConfigurationError({ reason, message, reference }: ConfigurationErrorProps) {
  return (
    <FatalNotice>
      <Notice tone="error" heading="Configuration error" reference={reference}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.secondary }}>
            Reason: {reason}
          </span>
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.secondary }}>
            {message}
          </span>
          <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>
            Check the public config.json served with this app.
          </span>
        </div>
      </Notice>
    </FatalNotice>
  );
}
