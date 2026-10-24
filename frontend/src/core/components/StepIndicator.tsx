import { body, color, font, label, space, tracking } from '../styles/tokens';

interface StepIndicatorProps {
  step: string;
  section: string;
  subtitle?: string;
}

const JOURNEY = 'Your identity · Your session · Your APIs';

/** Reusable journey indicator shown in the brand panel of the auth screens. */
export function StepIndicator({ step, section, subtitle }: StepIndicatorProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space[8],
        paddingTop: space[16],
        borderTop: `1px solid ${color.border.subtle}`,
      }}
    >
      <span
        style={{
          ...label[12],
          fontFamily: font.body,
          color: color.text.secondary,
          letterSpacing: tracking.eyebrow,
        }}
      >
        {step} / {section}
      </span>
      <span style={{ ...body[14], fontFamily: font.body, color: color.text.secondary }}>{JOURNEY}</span>
      {subtitle ? (
        <span style={{ ...body[13], fontFamily: font.body, color: color.text.secondary }}>{subtitle}</span>
      ) : null}
    </div>
  );
}
