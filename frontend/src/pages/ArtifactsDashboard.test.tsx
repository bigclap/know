import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../providers/AppProviders';
import { useWorkspaceStore } from '../store/workspaceStore';
import { ArtifactsDashboard } from './ArtifactsDashboard';

const renderDashboard = () =>
  render(
    <AppProviders>
      <ArtifactsDashboard />
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

describe('ArtifactsDashboard', () => {
  it('requests data for the current artifact when missing', () => {
    const loadArtifact = vi.fn();
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'idle',
      loadArtifact,
    });

    renderDashboard();

    expect(loadArtifact).toHaveBeenCalledWith('artifact-1');
  });

  it('renders artifact summary, children and structured entries', () => {
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'success',
      artifact: {
        id: 'artifact-1',
        title: 'Root artifact',
        summary: 'Artifact summary',
        parent_artifact_id: null,
        children: [
          { id: 'artifact-2', title: 'Child artifact' },
        ],
        messages: [],
        structured_entries: [
          {
            id: 'entry-1',
            artifact_id: 'artifact-1',
            text_representation: 'task: Plan release',
            data_json: { task: 'Plan release' },
            schema_id: null,
            created_at: '2024-03-01T12:00:00Z',
            updated_at: '2024-03-01T12:00:00Z',
          },
        ],
      },
    });

    renderDashboard();

    expect(screen.getByText('Artifact summary')).toBeInTheDocument();
    expect(screen.getByText('Child artifact')).toBeInTheDocument();
    expect(screen.getByText('task: Plan release')).toBeInTheDocument();
  });
});
