import { AppShell, Burger, Group, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarNav } from '../components/SidebarNav';

export const AppLayout = () => {
  const [opened, { toggle }] = useDisclosure(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AppShell
      layout="alt"
      header={{ height: 60 }}
      navbar={{ width: sidebarCollapsed ? 80 : 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
            <Title order={1}>Live Knowledge Workspace</Title>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <SidebarNav collapsed={sidebarCollapsed} onCollapseChange={setSidebarCollapsed} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
};
