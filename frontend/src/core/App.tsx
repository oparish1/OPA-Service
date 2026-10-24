import { useEffect } from 'react';
import { AppProvider } from './app/AppProvider';
import { useApp } from './app/app-context';
import type { Screen } from './mocks/types';
import { AccountIdentity } from './screens/AccountIdentity';
import { ChangePassword } from './screens/ChangePassword';
import { ForgotPassword } from './screens/ForgotPassword';
import { HomeSignIn } from './screens/HomeSignIn';
import { Overview } from './screens/Overview';
import { ProfileAPI } from './screens/ProfileAPI';
import { ProjectsAPI } from './screens/ProjectsAPI';

const SCREEN_TITLES: Record<Screen, string> = {
  'sign-in': 'Sign in',
  'forgot-password': 'Forgot password',
  'change-password': 'Change password',
  overview: 'Overview',
  account: 'Account & identity',
  'profile-api': 'Profile API',
  'projects-api': 'Projects API',
};

function ScreenRouter() {
  const { screen } = useApp();

  useEffect(() => {
    document.title = `${SCREEN_TITLES[screen]} · Your Identity`;
  }, [screen]);

  switch (screen) {
    case 'sign-in':
      return <HomeSignIn />;
    case 'forgot-password':
      return <ForgotPassword />;
    case 'change-password':
      return <ChangePassword />;
    case 'overview':
      return <Overview />;
    case 'account':
      return <AccountIdentity />;
    case 'profile-api':
      return <ProfileAPI />;
    case 'projects-api':
      return <ProjectsAPI />;
  }
}

export function App() {
  return (
    <AppProvider>
      <ScreenRouter />
    </AppProvider>
  );
}
