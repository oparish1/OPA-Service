import { Braces, ChevronDown, FolderKanban, LayoutDashboard, LogOut, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp } from '../app/app-context';
import { Badge } from '../components/Badge';
import { Logo } from '../components/Logo';
import { NavigationItem } from '../components/NavigationItem';
import { TextLink } from '../components/TextLink';
import type { Screen } from '../mocks/types';
import { body, color, font, heading, label, size, space, tracking, weight } from '../styles/tokens';

interface WorkspaceLayoutProps {
  active: Screen;
  breadcrumb: string;
  title: string;
  statusBadge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

const NAV_SECTIONS: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ screen: Screen; label: string; icon: ReactNode }>;
}> = [
  {
    label: 'WORKSPACE',
    items: [
      { screen: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} aria-hidden /> },
      { screen: 'account', label: 'Account & identity', icon: <UserRound size={16} aria-hidden /> },
    ],
  },
  {
    label: 'DOWNSTREAM APIs',
    items: [
      { screen: 'profile-api', label: 'Profile API', icon: <Braces size={16} aria-hidden /> },
      { screen: 'projects-api', label: 'Projects API', icon: <FolderKanban size={16} aria-hidden /> },
    ],
  },
];

/** Workspace shell: header + 240 px sidebar + main content. */
export function WorkspaceLayout({
  active,
  breadcrumb,
  title,
  statusBadge,
  actions,
  children,
}: WorkspaceLayoutProps) {
  const { navigate, signOut } = useApp();

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
            Agentic Advantage
          </span>
          <ChevronDown size={16} aria-hidden color={color.text.secondary} />
          <Badge tone="neutral">DEMO WORKSPACE</Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: space[20] }}>
          {statusBadge ?? <Badge tone="success">Session active</Badge>}
          <span style={{ ...body[14], fontFamily: font.body, color: color.text.primary }}>
            Orlando Parish
          </span>
          <TextLink onClick={signOut} trailingIcon={<LogOut size={15} aria-hidden />}>
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
                {section.items.map(item => (
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
            <span style={{ ...body[12], fontFamily: font.body, color: color.text.secondary }}>
              Illustrative providers &amp; endpoints. All credentials are demo values.
            </span>
            <TextLink href="#">Documentation</TextLink>
            <span style={{ ...label[11], fontFamily: font.body, color: color.text.secondary }}>
              Sandbox · v1.0
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
          {children}
        </main>
      </div>
    </div>
  );
}
