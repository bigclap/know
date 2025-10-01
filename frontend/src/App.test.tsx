import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { AppProviders } from './providers/AppProviders';
import { routes } from './routes';

const renderWithRouter = () => {
  const router = createMemoryRouter(routes);
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

describe('App shell', () => {
  it('renders workspace navigation', () => {
    renderWithRouter();

    expect(
      screen.getByRole('heading', { name: /Live Knowledge Workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Artifacts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Chat/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Graph/i })).toBeInTheDocument();
  });
});
