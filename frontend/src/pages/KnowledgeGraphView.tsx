import { Card, Divider, Group, Stack, Text, Title } from '@mantine/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const KnowledgeGraphView = () => {
  const graph = useWorkspaceStore((state) => state.graphSnapshot);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Knowledge graph</Title>
        <Text c="dimmed">Review how artifacts connect through schemas and links.</Text>
      </div>
      <Card withBorder padding="lg" radius="md">
        <Stack gap="sm">
          {graph.map((node) => (
            <Stack key={node.id} gap="xs">
              <Group justify="space-between">
                <Text fw={600}>{node.label}</Text>
                <Text size="sm" c="dimmed">
                  {node.kind}
                </Text>
              </Group>
              <Divider my="xs" />
              <Stack gap={4}>
                {node.links.length === 0 && (
                  <Text size="sm" c="dimmed">
                    No outgoing links yet.
                  </Text>
                )}
                {node.links.map((link) => (
                  <Text key={link.id} size="sm">
                    ↳ {link.label} → {link.targetLabel}
                  </Text>
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
};
