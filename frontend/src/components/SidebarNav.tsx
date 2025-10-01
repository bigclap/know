import {
  ActionIcon,
  Flex,
  NavLink,
  ScrollArea,
  Stack,
  Tooltip,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconFolders,
  IconGraph,
  IconMessageCircle,
  IconMoonStars,
  IconSun,
} from '@tabler/icons-react';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWorkspaceStore } from '../store/workspaceStore';

type SidebarNavProps = {
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
};

export const SidebarNav = ({ collapsed, onCollapseChange }: SidebarNavProps) => {
  const location = useLocation();
  const toggleTheme = useWorkspaceStore((state) => state.toggleTheme);
  const theme = useWorkspaceStore((state) => state.theme);

  const items = useMemo(
    () => [
      { label: 'Artifacts', description: 'Browse artifacts and summaries', to: '/', icon: IconFolders },
      { label: 'Chat', description: 'Converse about the current artifact', to: '/chat', icon: IconMessageCircle },
      { label: 'Graph', description: 'Explore knowledge graph links', to: '/graph', icon: IconGraph },
    ],
    [],
  );

  return (
    <Flex direction="column" h="100%">
      <ScrollArea type="auto" offsetScrollbars h="100%">
        <Stack gap="xs" p="sm">
          {items.map((item) => {
            const active = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                label={item.label}
                description={!collapsed ? item.description : undefined}
                component={Link}
                to={item.to}
                active={active}
                leftSection={<Icon size={20} />}
              />
            );
          })}
        </Stack>
      </ScrollArea>
      <Flex p="sm" justify="space-between" align="center">
        <Tooltip label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
          <ActionIcon variant="default" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? <IconMoonStars size={18} /> : <IconSun size={18} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
          <ActionIcon
            variant="default"
            onClick={() => onCollapseChange(!collapsed)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
          </ActionIcon>
        </Tooltip>
      </Flex>
    </Flex>
  );
};
