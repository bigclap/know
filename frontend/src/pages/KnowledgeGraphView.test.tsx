import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../providers/AppProviders';
import { useWorkspaceStore } from '../store/workspaceStore';
import { KnowledgeGraphView } from './KnowledgeGraphView';

const renderView = () =>
  render(
    <AppProviders>
      <KnowledgeGraphView />
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

describe('KnowledgeGraphView', () => {
  it('shows structured entries and existing links', () => {
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'success',
      artifact: {
        id: 'artifact-1',
        title: 'Root artifact',
        summary: 'Summary',
        parent_artifact_id: null,
        children: [
          { id: 'artifact-2', title: 'Child artifact' },
        ],
        messages: [],
        structured_entries: [
          {
            id: 'entry-1',
            artifact_id: 'artifact-1',
            text_representation: 'Key insight',
            data_json: {},
            schema_id: null,
            created_at: '2024-03-01T12:00:00Z',
            updated_at: '2024-03-01T12:00:00Z',
          },
        ],
      },
      links: [
        {
          id: 'link-1',
          source_entity_type: 'artifact',
          source_entity_id: 'artifact-1',
          target_entity_type: 'artifact',
          target_entity_id: 'artifact-2',
          link_type: 'relates_to',
          description: 'Связанные артефакты',
          created_at: '2024-03-01T12:00:00Z',
          updated_at: '2024-03-01T12:00:00Z',
        },
      ],
    });

    renderView();

    expect(screen.getByText('Child artifact')).toBeInTheDocument();
    expect(screen.getByText('Key insight')).toBeInTheDocument();
    expect(screen.getByText(/relates_to/i)).toBeInTheDocument();
  });

  it('submits a new link using the store action', async () => {
    const createLink = vi.fn().mockResolvedValue({
      id: 'link-2',
      source_entity_type: 'artifact',
      source_entity_id: 'artifact-1',
      target_entity_type: 'artifact',
      target_entity_id: 'artifact-3',
      link_type: 'supports',
      description: 'Supports release plan',
      created_at: '2024-03-02T12:00:00Z',
      updated_at: '2024-03-02T12:00:00Z',
    });
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
        messages: [],
      },
      links: [],
      createLink,
    });

    renderView();

    fireEvent.change(screen.getByLabelText(/Target entity type/i), {
      target: { value: 'artifact' },
    });
    fireEvent.change(screen.getByLabelText(/Target entity ID/i), {
      target: { value: 'artifact-3' },
    });
    fireEvent.change(screen.getByLabelText(/Link type/i), {
      target: { value: 'supports' },
    });
    fireEvent.change(screen.getByLabelText(/Description/i), {
      target: { value: 'Supports release plan' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create link/i }));

    await waitFor(() =>
      expect(createLink).toHaveBeenCalledWith({
        targetEntityType: 'artifact',
        targetEntityId: 'artifact-3',
        linkType: 'supports',
        description: 'Supports release plan',
      }),
    );
  });
});
