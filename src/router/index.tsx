import { createBrowserRouter } from 'react-router';
import { ProtectedAppLayout } from '@/components/layout/ProtectedAppLayout';
import { GuestRoute } from '@/components/shared/GuestRoute';
import { LoginPage } from '@/pages/login/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { TripsPage } from '@/pages/trips/TripsPage';
import { ComplaintsPage } from '@/pages/complaints/ComplaintsPage';
import { PromosPage } from '@/pages/promos/PromosPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { VehiclesPage } from '@/pages/vehicles/VehiclesPage';
import { WalletsPage } from '@/pages/wallets/WalletsPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';

// Wrap LoginPage in GuestRoute to redirect authenticated users
function LoginPageGuarded() {
  return (
    <GuestRoute>
      <LoginPage />
    </GuestRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPageGuarded,
  },
  {
    path: '/',
    Component: ProtectedAppLayout,
    children: [
      {
        index: true,
        Component: DashboardPage,
      },
      {
        path: 'users',
        Component: UsersPage,
      },
      {
        path: 'trips',
        Component: TripsPage,
      },
      {
        path: 'complaints',
        Component: ComplaintsPage,
      },
      {
        path: 'promos',
        Component: PromosPage,
      },
      {
        path: 'settings',
        Component: SettingsPage,
      },
      {
        path: 'vehicles',
        Component: VehiclesPage,
      },
      {
        path: 'wallets',
        Component: WalletsPage,
      },
      {
        path: 'notifications',
        Component: NotificationsPage,
      },
      {
        path: 'profile',
        Component: ProfilePage,
      },
    ],
  },
]);
