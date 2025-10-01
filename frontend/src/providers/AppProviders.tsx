import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import { PropsWithChildren, useEffect } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import '../styles/index.css';

export const AppProviders = ({ children }: PropsWithChildren) => {
  const theme = useWorkspaceStore((state) => state.theme);
  const setTheme = useWorkspaceStore((state) => state.setTheme);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, [setTheme]);

  return (
    <>
      <ColorSchemeScript />
      <MantineProvider defaultColorScheme={theme}>{children}</MantineProvider>
    </>
  );
};
