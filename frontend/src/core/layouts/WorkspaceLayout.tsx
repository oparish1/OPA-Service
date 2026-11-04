import { Braces, ChevronDown, FolderKanban, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../app/app-context';
import { refreshCapabilities } from '../authz/engine';
import type { CapabilityId } from '../authz/types';
import { useCapabilities } from '../authz/useCapabilities';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { NavigationItem } from '../components/NavigationItem';
import { Notice } from '../components/Notice';
import { TextLink } from '../components/TextLink';
import { appConfig } from '../config/app-config';
import { PERMISSIONS_UNAVAILABLE } from '../lib/copy';
import type { Screen } from '../mocks/types';
import { getSession } from '../session/store';
import { body, color, font, heading, label, size, space, tracking, weight } from '../styles/tokens';

interface WorkspaceLayoutProps {
  active: Screen;
  breadcrumb: string;
  title: string;
  /** Overrides the default badge derived from the session store. */
  statusBadge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Badge shown for the session store's state. Tone names must match what
 * <Badge> supports. There is no "expiring" state until the store exposes
 * how much time is left.
 */
const SESSION_STATUS = {
  active: { tone: 'success', text: 'Session active' },
  expired: { tone: 'error', text: 'Session expired' },
} as const;

const ICON_SIZE = size.iconSmall;

/**
 * Navigation structure. Screen ids are typed code identifiers;
 * move labels to your i18n catalogue if you localise the app.
 */
const NAV_SECTIONS: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ screen: Screen; label: string; icon: ReactNode; capability: CapabilityId }>;
}> = [
  {
    label: 'WORKSPACE',
    items: [
      {
        screen: 'overview',
        label: 'Overview',
        icon: <LayoutDashboard size={ICON_SIZE} aria-hidden />,
        capability: 'nav.overview',
      },
      {
        screen: 'account',
        label: 'Account & identity',
        icon: <UserRound size={ICON_SIZE} aria-hidden />,
        capability: 'nav.account',
      },
    ],
  },
  {
    label: 'DOWNSTREAM APIs',
    items: [
      {
        screen: 'profile-api',
        label: 'Profile API',
        icon: <Braces size={ICON_SIZE} aria-hidden />,
        capability: 'nav.api.profile',
      },
      {
        screen: 'projects-api',
        label: 'Projects API',
        icon: <FolderKanban size={ICON_SIZE} aria-hidden />,
        capability: 'nav.api.projects',
      },
    ],
  },
];

/** Workspace shell: header + sidebar + main content. */
export function WorkspaceLayout({
  active,
  breadcrumb,
  title,
  statusBadge,
  actions,
  children,
}: WorkspaceLayoutProps) {
  const { navigate, signOut } = useApp();
  const { capabilities, status: authzStatus } = useCapabilities();

  // The signed-in identity comes from the session store, the same source the
  // Account screen reads. The layout only renders while signed in.
  const session = getSession();
  const status = SESSION_STATUS[session ? 'active' : 'expired'];
  const userName = session?.account?.displayName || session?.account?.email || '';

  return (
    <div style={{ minWidth: size.desktopMinWidth, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          height: size.workspaceHeaderHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${space[40]}px`,
          borderBottom: `1px solid ${color.border.subtle}`,
          background: color.background.canvas,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space[20] }}>
          <Logo />
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.primary }}>
            {appConfig.workspaceName}
          </span>
          <ChevronDown size={ICON_SIZE} aria-hidden color={color.text.secondary} />
          {appConfig.isDemo && <Badge tone="neutral">DEMO WORKSPACE</Badge>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[20] }}>
          {statusBadge ?? <Badge tone={status.tone}>{status.text}</Badge>}
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.primary }}>
            {userName}
          </span>
          <TextLink onClick={signOut} trailingIcon={<LogOut size={ICON_SIZE} aria-hidden />}>
            Sign out
          </TextLink>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
        <nav
          aria-label="Workspace"
          style={{
            width: size.sidebarWidth,
            flexShrink: 0,
            background: color.surface.subtle,
            borderRight: `1px solid ${color.border.subtle}`,
            padding: `${space[24]}px 0`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[24] }}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label} style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
                <span
                  style={{
                    ...label[11],
                    fontFamily: font.body,
                    color: color.text.secondary,
                    letterSpacing: tracking.eyebrow,
                    padding: `0 ${space[16]}px ${space[4]}px`,
                  }}
                >
                  {section.label}
                </span>
                {section.items
                  .filter(item => capabilities[item.capability].allowed)
                  .map(item => (
                    <NavigationItem
                      key={item.screen}
                      label={item.label}
                      icon={item.icon}
                      selected={active === item.screen}
                      onClick={() => navigate(item.screen)}
                    />
                  ))}
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[8],
              padding: `0 ${space[16]}px`,
            }}
          >
            {appConfig.isDemo && (
              <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
                Illustrative providers &amp; endpoints. All credentials are demo values.
              </span>
            )}
            {appConfig.docsUrl && <TextLink href={appConfig.docsUrl}>Documentation</TextLink>}
            <span style={{ ...label[11], fontFamily: font.body, color: color.text.secondary }}>
              {appConfig.environment} · v{appConfig.version}
            </span>
          </div>
        </nav>

        <main
          style={{
            flex: 1,
            padding: space[40],
            display: 'flex',
            flexDirection: 'column',
            gap: space[24],
          }}
        >
          <span
            style={{ ...label[12], fontFamily: font.body, color: color.text.secondary, letterSpacing: tracking.eyebrow }}
          >
            {breadcrumb}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space[20],
            }}
          >
            <h1
              style={{
                margin: 0,
                ...heading[40],
                fontFamily: font.heading,
                fontWeight: weight.medium,
                color: color.text.primary,
              }}
            >
              {title}
            </h1>
            {actions}
          </div>
          {authzStatus === 'error' ? (
            <Notice
              tone="error"
              heading={PERMISSIONS_UNAVAILABLE}
              action={
                <Button variant="secondary" onClick={() => void refreshCapabilities()}>
                  Retry
                </Button>
              }
            >
              Some controls stay unavailable until permissions load.
            </Notice>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}