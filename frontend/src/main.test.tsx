import React from 'react';
import { describe, expect, it, vi } from 'vitest';

describe('main bootstrap', () => {
  it('imports global styles before rendering the app', async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';

    const routerMock = Symbol('router');

    vi.doMock('./routes', () => ({
      createAppRouter: vi.fn(() => routerMock),
    }));

    vi.doMock('react-router-dom', () => ({
      RouterProvider: ({ router }: { router: unknown }) => <div data-router={String(router)} />,
    }));

    vi.doMock('./providers/AppProviders', () => ({
      AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }));

    let mainStylesImported = 0;

    vi.doMock('./styles/index.css', () => {
      mainStylesImported += 1;
      return {};
    });

    const renderMock = vi.fn();
    const createRootMock = vi.fn(() => ({ render: renderMock }));

    vi.doMock('react-dom/client', () => ({
      default: {
        createRoot: createRootMock,
      },
    }));

    await import('./main');

    expect(mainStylesImported).toBeGreaterThan(0);
    expect(createRootMock).toHaveBeenCalledWith(document.getElementById('root'));
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
