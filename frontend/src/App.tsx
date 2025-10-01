import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { createAppRouter } from './routes';

export const App = () => (
  <AppProviders>
    <RouterProvider router={createAppRouter()} />
  </AppProviders>
);
