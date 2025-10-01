import { Alert, Button, Card, Group, Loader, Stack, Text, TextInput, Title } from '@mantine/core';
import { FormEvent, useEffect, useState } from 'react';
import { useArtifactData } from '../store/hooks';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ArtifactsDashboard = () => {
  const { artifact, status, error, currentArtifactId } = useArtifactData();
  const loadArtifact = useWorkspaceStore((state) => state.loadArtifact);
  const [artifactIdInput, setArtifactIdInput] = useState(currentArtifactId ?? '');

  useEffect(() => {
    setArtifactIdInput(currentArtifactId ?? '');
  }, [currentArtifactId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = artifactIdInput.trim();
    if (trimmed) {
      void loadArtifact(trimmed);
    }
  };

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Artifacts overview</Title>
        <Text c="dimmed">Track the latest knowledge contributions and summaries.</Text>
      </div>

      <form onSubmit={handleSubmit}>
        <Group align="flex-end" gap="md">
          <TextInput
            label="Artifact ID"
            placeholder="Enter an artifact UUID"
            value={artifactIdInput}
            onChange={(event) => setArtifactIdInput(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" loading={status === 'loading'}>
            Load artifact
          </Button>
        </Group>
      </form>

      {status === 'loading' && (
        <Group justify="center">
          <Loader />
        </Group>
      )}

      {status === 'error' && error && (
        <Alert color="red" title="Failed to load artifact">
          {error}
        </Alert>
      )}

      {status === 'success' && artifact && (
        <Stack gap="lg">
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs">
              <Title order={3}>{artifact.title}</Title>
              <Text c="dimmed">{artifact.summary || 'No summary available yet.'}</Text>
            </Stack>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Structured entries</Title>
                <Text size="sm" c="dimmed">
                  {artifact.structured_entries.length} total
                </Text>
              </Group>
              <Stack gap="xs">
                {artifact.structured_entries.length === 0 && (
                  <Text size="sm" c="dimmed">
                    No structured entries available for this artifact.
                  </Text>
                )}
                {artifact.structured_entries.map((entry) => (
                  <Card key={entry.id} withBorder padding="md" radius="md">
                    <Stack gap={4}>
                      <Text>{entry.text_representation}</Text>
                      {entry.schema_id && (
                        <Text size="xs" c="dimmed">
                          Schema: {entry.schema_id}
                        </Text>
                      )}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Card>

          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Child artifacts</Title>
                <Text size="sm" c="dimmed">
                  {artifact.children.length} total
                </Text>
              </Group>
              <Stack gap="xs">
                {artifact.children.length === 0 && (
                  <Text size="sm" c="dimmed">
                    No child artifacts linked yet.
                  </Text>
                )}
                {artifact.children.map((child) => (
                  <Card key={child.id} withBorder padding="md" radius="md">
                    <Text fw={600}>{child.title}</Text>
                    <Text size="xs" c="dimmed">
                      {child.id}
                    </Text>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
};
