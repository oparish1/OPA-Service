import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';
import { Logo } from '../components/Logo';
import { TextLink } from '../components/TextLink';
import { PublicFooter } from '../components/PublicFooter';
import { StepIndicator } from '../components/StepIndicator';
import { body, color, font, heading, label, size, space, tracking, weight } from '../styles/tokens';

interface PublicLayoutProps {
  brandLabel: string;
  brandHeading: string;
  brandBody?: string;
  step: string;
  section: string;
  subtitle?: string;
  title: string;
  description?: string;
  backLink?: ReactNode;
  minHeight?: number | string;
  children: ReactNode;
}

function PublicNav() {
  return (
    <header
      style={{
        height: size.publicNavHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${space[40]}px`,
        borderBottom: `1px solid ${color.border.subtle}`,
        background: color.background.canvas,
      }}
    >
      <Logo />
      <div style={{ display: 'flex', alignItems: 'center', gap: space[20] }}>
        <Badge tone="neutral">DEMO WORKSPACE</Badge>
        <TextLink href="#" trailingIcon={<ArrowUpRight size={15} aria-hidden />}>
          Need help?
        </TextLink>
      </div>
    </header>
  );
}

/** Split-pane shell shared by the three public auth screens. */
export function PublicLayout({
  brandLabel,
  brandHeading,
  brandBody,
  step,
  section,
  subtitle,
  title,
  description,
  backLink,
  minHeight = '100vh',
  children,
}: PublicLayoutProps) {
  return (
    <div style={{ minWidth: size.desktopMinWidth, minHeight, display: 'flex', flexDirection: 'column' }}>
      <PublicNav />
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
        <aside
          style={{
            width: size.brandPanelWidth,
            flexShrink: 0,
            background: color.background.brand,
            padding: space[64],
            display: 'flex',
            flexDirection: 'column',
            gap: space[32],
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
            {brandLabel}
          </span>
          <h1
            style={{
              margin: 0,
              ...heading[58],
              fontFamily: font.heading,
              color: color.text.primary,
              fontWeight: weight.medium,
              whiteSpace: 'pre-line',
            }}
          >
            {brandHeading}
          </h1>
          {brandBody ? (
            <p style={{ margin: 0, ...body[18], fontFamily: font.body, color: color.text.secondary }}>
              {brandBody}
            </p>
          ) : null}
          <StepIndicator step={step} section={section} subtitle={subtitle} />
        </aside>
        <main
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            padding: `${space[64]}px ${space[48]}px`,
          }}
        >
          <div style={{ width: '100%', maxWidth: size.contentMaxWidth, display: 'flex', flexDirection: 'column', gap: space[32] }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
              {backLink}
              <h2
                style={{
                  margin: 0,
                  ...heading[36],
                  fontFamily: font.heading,
                  fontWeight: weight.medium,
                  color: color.text.primary,
                }}
              >
                {title}
              </h2>
              {description ? (
                <p style={{ margin: 0, ...body[15], fontFamily: font.body, color: color.text.secondary }}>
                  {description}
                </p>
              ) : null}
            </div>
            {children}
          </div>
        </main>
      </div>
      <PublicFooter />
    </div>
  );
}
