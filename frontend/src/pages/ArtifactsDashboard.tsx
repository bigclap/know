import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ArtifactsDashboard = () => {
  const recentArtifacts = useWorkspaceStore((state) => state.recentArtifacts);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Artifacts overview</Title>
        <Text c="dimmed">Track the latest knowledge contributions and summaries.</Text>
      </div>
      <Group align="stretch">
        {recentArtifacts.map((artifact) => (
          <Card key={artifact.id} shadow="sm" padding="lg" radius="md" withBorder miw={240}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Title order={4}>{artifact.title}</Title>
                <Badge color={artifact.status === 'draft' ? 'yellow' : 'green'}>{artifact.status}</Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {artifact.summary}
              </Text>
            </Stack>
          </Card>
        ))}
      </Group>
    </Stack>
  );
};
