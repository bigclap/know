import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProviders } from './providers/AppProviders';
import { createAppRouter } from './routes';
import './styles/index.css';
import '@mantine/core/styles.css';

const router = createAppRouter();
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <AppProviders>
          <RouterProvider router={router} />
        </AppProviders>
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
