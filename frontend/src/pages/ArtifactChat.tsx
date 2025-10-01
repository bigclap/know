import { Button, Group, Paper, Stack, Text, Textarea, Title } from '@mantine/core';
import { useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ArtifactChat = () => {
  const [message, setMessage] = useState('');
  const thread = useWorkspaceStore((state) => state.activeThread);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Artifact conversation</Title>
        <Text c="dimmed">Discuss insights with collaborators and AI assistants.</Text>
      </div>
      <Stack gap="sm">
        {thread.map((entry) => (
          <Paper key={entry.id} p="sm" shadow="xs" radius="md" bg={entry.role === 'user' ? 'blue.0' : 'grape.0'}>
            <Stack gap={4}>
              <Text fw={600}>{entry.role === 'user' ? 'You' : 'Assistant'}</Text>
              <Text>{entry.content}</Text>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Stack gap="xs">
        <Textarea
          placeholder="Share an update or ask the AI"
          minRows={3}
          value={message}
          onChange={(event) => setMessage(event.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button disabled={!message.trim()} onClick={() => setMessage('')}>
            Send message
          </Button>
        </Group>
      </Stack>
    </Stack>
  );
};
