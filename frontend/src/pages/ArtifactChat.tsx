import { Alert, Button, Group, Loader, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { apiClient } from '../api/client';
import { useArtifactData } from '../store/hooks';

export const ArtifactChat = () => {
  const { artifact, artifactId, isLoading, error } = useArtifactData();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [newArtifactTitle, setNewArtifactTitle] = useState('');

  const messageMutation = useMutation({
    mutationFn: apiClient.postChatMessage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts', artifactId] });
      setMessage('');
    },
  });

  const artifactMutation = useMutation({
    mutationFn: apiClient.createArtifact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
      setNewArtifactTitle('');
    },
  });

  const thread = artifact?.messages ?? [];

  const handleMessageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !artifactId) {
      return;
    }
    messageMutation.mutate({ artifact_id: artifactId, content: trimmed, sender: 'user' });
  };

  const handleArtifactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newArtifactTitle.trim();
    if (!trimmed || !artifactId) {
      return;
    }
    artifactMutation.mutate({ title: trimmed, parent_artifact_id: artifactId });
  };


  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>{artifact?.title}</Title>
        <Text c="dimmed">{artifact?.summary}</Text>
      </div>

      <form onSubmit={handleArtifactSubmit}>
        <Group>
          <TextInput
            placeholder="New sub-artifact title"
            value={newArtifactTitle}
            onChange={(event) => setNewArtifactTitle(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit" disabled={!newArtifactTitle.trim()} loading={artifactMutation.isPending}>
            Create Sub-Artifact
          </Button>
        </Group>
      </form>

      {error && (
        <Alert color="red" title="Failed to load artifact thread">
          {error.message}
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

      <form onSubmit={handleMessageSubmit}>
        <Stack gap="xs">
          <Textarea
            placeholder="Share an update or ask the AI"
            minRows={3}
            value={message}
            onChange={(event) => setMessage(event.currentTarget.value)}
          />
          {messageMutation.isError && (
            <Alert color="red" title="Unable to send message">
              {messageMutation.error.message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button type="submit" disabled={!message.trim()} loading={messageMutation.isPending}>
              Send message
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
};
