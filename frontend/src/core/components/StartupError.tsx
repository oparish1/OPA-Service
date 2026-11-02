import { body, color, font } from '../styles/tokens';
import { FatalNotice } from './FatalNotice';
import { Notice } from './Notice';

interface StartupErrorProps {
  message: string;
  reference: string;
}

/** Shown when the app fails after config loaded; the cause is not the config file. */
export function StartupError({ message, reference }: StartupErrorProps) {
  return (
    <FatalNotice>
      <Notice tone="error" heading="Something went wrong" reference={reference}>
        <span style={{ ...body[14], fontFamily: font.body, color: color.text.secondary }}>
          {message}
        </span>
      </Notice>
    </FatalNotice>
  );
}
