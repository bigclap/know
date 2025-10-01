import { Alert, Button, Card, Divider, Group, Loader, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { ChangeEvent, FormEvent, useState } from 'react';
import { useArtifactData } from '../store/hooks';
import { useWorkspaceStore } from '../store/workspaceStore';

export const KnowledgeGraphView = () => {
  const { artifact, status, error } = useArtifactData();
  const links = useWorkspaceStore((state) => state.links);
  const createLink = useWorkspaceStore((state) => state.createLink);
  const [formState, setFormState] = useState({
    targetEntityType: 'artifact',
    targetEntityId: '',
    linkType: '',
    description: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof typeof formState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormState((state) => ({ ...state, [field]: event.target.value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.targetEntityType || !formState.targetEntityId || !formState.linkType) {
      setFormError('All fields except description are required.');
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await createLink({
        targetEntityType: formState.targetEntityType,
        targetEntityId: formState.targetEntityId,
        linkType: formState.linkType,
        description: formState.description || undefined,
      });
      setFormState({ targetEntityType: 'artifact', targetEntityId: '', linkType: '', description: '' });
    } catch (submitException) {
      const message =
        submitException instanceof Error ? submitException.message : 'Failed to create link';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = status === 'loading' || status === 'idle';

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Knowledge graph</Title>
        <Text c="dimmed">Review how artifacts connect through schemas and links.</Text>
      </div>

      {status === 'error' && error && (
        <Alert color="red" title="Failed to load graph data">
          {error}
        </Alert>
      )}

      {isLoading && (
        <Group justify="center">
          <Loader />
        </Group>
      )}

      {status === 'success' && artifact && (
        <Stack gap="lg">
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
                    No structured entries captured yet.
                  </Text>
                )}
                {artifact.structured_entries.map((entry) => (
                  <Card key={entry.id} withBorder padding="md" radius="md">
                    <Text>{entry.text_representation}</Text>
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
                    No child artifacts registered.
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

          <Card withBorder padding="lg" radius="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={4}>Knowledge links</Title>
                <Text size="sm" c="dimmed">
                  {links.length} total
                </Text>
              </Group>
              <Stack gap={4}>
                {links.length === 0 && (
                  <Text size="sm" c="dimmed">
                    No links have been created in this session.
                  </Text>
                )}
                {links.map((link) => (
                  <Text key={link.id} size="sm">
                    ↳ {link.link_type} → {link.target_entity_id}
                    {link.description ? ` — ${link.description}` : ''}
                  </Text>
                ))}
              </Stack>
              <Divider my="sm" />
              <form onSubmit={handleSubmit}>
                <Stack gap="sm">
                  <TextInput
                    label="Target entity type"
                    placeholder="artifact, schema, entry"
                    value={formState.targetEntityType}
                    onChange={handleChange('targetEntityType')}
                  />
                  <TextInput
                    label="Target entity ID"
                    placeholder="Enter UUID"
                    value={formState.targetEntityId}
                    onChange={handleChange('targetEntityId')}
                  />
                  <TextInput
                    label="Link type"
                    placeholder="e.g. relates_to, derives_from"
                    value={formState.linkType}
                    onChange={handleChange('linkType')}
                  />
                  <Textarea
                    label="Description"
                    placeholder="Describe the relationship"
                    minRows={2}
                    value={formState.description}
                    onChange={handleChange('description')}
                  />
                  {formError && (
                    <Alert color="red" title="Unable to create link">
                      {formError}
                    </Alert>
                  )}
                  <Group justify="flex-end">
                    <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                      Create link
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
};
