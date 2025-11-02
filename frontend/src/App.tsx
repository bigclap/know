import { Outlet } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';

export const App = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);
