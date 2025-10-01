import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../providers/AppProviders';
import { useWorkspaceStore } from '../store/workspaceStore';
import { ArtifactChat } from './ArtifactChat';

const renderChat = () =>
  render(
    <AppProviders>
      <ArtifactChat />
    </AppProviders>,
  );

const initialState = useWorkspaceStore.getState();

beforeEach(() => {
  useWorkspaceStore.setState(initialState, true);
});

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.setState(initialState, true);
});

describe('ArtifactChat', () => {
  it('renders existing messages from the artifact thread', () => {
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'success',
      artifact: {
        id: 'artifact-1',
        title: 'Root artifact',
        summary: 'Summary',
        parent_artifact_id: null,
        children: [],
        structured_entries: [],
        messages: [
          {
            id: 1,
            artifact_id: 'artifact-1',
            content: 'How do we plan the release?',
            sender: 'user',
            created_at: '2024-03-01T12:00:00Z',
            updated_at: '2024-03-01T12:00:00Z',
          },
        ],
      },
    });

    renderChat();

    expect(screen.getByText('How do we plan the release?')).toBeInTheDocument();
  });

  it('submits a new message via the store action', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'success',
      sendMessage,
      artifact: {
        id: 'artifact-1',
        title: 'Root artifact',
        summary: 'Summary',
        parent_artifact_id: null,
        children: [],
        structured_entries: [],
        messages: [],
      },
    });

    renderChat();

    fireEvent.change(screen.getByPlaceholderText(/Share an update/i), {
      target: { value: 'New message' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Send message/i }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'New message' }),
      ),
    );
    expect(screen.getByPlaceholderText(/Share an update/i)).toHaveValue('');
  });
});
