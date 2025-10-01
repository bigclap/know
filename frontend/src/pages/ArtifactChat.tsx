import { Alert, Button, Group, Loader, Paper, Stack, Text, Textarea, Title } from '@mantine/core';
import { FormEvent, useState } from 'react';
import { useArtifactData } from '../store/hooks';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ArtifactChat = () => {
  const { artifact, status, error } = useArtifactData();
  const sendMessage = useWorkspaceStore((state) => state.sendMessage);
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const thread = artifact?.messages ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await sendMessage({ content: trimmed, sender: 'user' });
      setMessage('');
    } catch (submitException) {
      const messageText =
        submitException instanceof Error ? submitException.message : 'Failed to send message';
      setSubmitError(messageText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = status === 'loading' || status === 'idle';

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Artifact conversation</Title>
        <Text c="dimmed">Discuss insights with collaborators and AI assistants.</Text>
      </div>

      {status === 'error' && error && (
        <Alert color="red" title="Failed to load artifact thread">
          {error}
        </Alert>
      )}

      {isLoading && (
        <Group justify="center">
          <Loader />
        </Group>
      )}

      {!isLoading && thread.length === 0 && (
        <Text c="dimmed">No messages yet. Start the conversation below.</Text>
      )}

      <Stack gap="sm">
        {thread.map((entry) => (
          <Paper
            key={entry.id}
            p="sm"
            shadow="xs"
            radius="md"
            bg={entry.sender ? 'blue.0' : 'grape.0'}
          >
            <Stack gap={4}>
              <Text fw={600}>{entry.sender ? entry.sender : 'Assistant'}</Text>
              <Text>{entry.content}</Text>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <form onSubmit={handleSubmit}>
        <Stack gap="xs">
          <Textarea
            placeholder="Share an update or ask the AI"
            minRows={3}
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
          />
          {submitError && (
            <Alert color="red" title="Unable to send message">
              {submitError}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" disabled={!message.trim()} loading={isSubmitting}>
              Send message
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};
