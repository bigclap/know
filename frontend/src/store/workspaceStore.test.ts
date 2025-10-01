import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

const initialState = useWorkspaceStore.getState();

const mockFetch = (payload: unknown) => {
  const response = {
    ok: true,
    headers: {
      get: () => 'application/json',
    },
    json: async () => payload,
  } as Partial<Response>;
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  useWorkspaceStore.setState(initialState, true);
});

afterEach(() => {
  vi.restoreAllMocks();
  useWorkspaceStore.setState(initialState, true);
});

const sampleArtifact = {
  id: 'artifact-1',
  title: 'Root artifact',
  summary: 'Artifact summary',
  parent_artifact_id: null,
  children: [{ id: 'artifact-2', title: 'Child artifact' }],
  messages: [],
  structured_entries: [
    {
      id: 'entry-1',
      artifact_id: 'artifact-1',
      data_json: { task: 'Plan release' },
      text_representation: 'task: Plan release',
      schema_id: null,
      created_at: '2024-03-01T12:00:00Z',
      updated_at: '2024-03-01T12:00:00Z',
    },
  ],
};

describe('workspaceStore', () => {
  it('loads artifact details from the backend', async () => {
    const fetchMock = mockFetch(sampleArtifact);

    await useWorkspaceStore.getState().loadArtifact('artifact-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/artifacts/artifact-1');
    const state = useWorkspaceStore.getState();
    expect(state.currentArtifactId).toBe('artifact-1');
    expect(state.artifact?.title).toBe('Root artifact');
    expect(state.artifactStatus).toBe('success');
    expect(state.artifactError).toBeNull();
  });

  it('posts a chat message and appends it to the artifact thread', async () => {
    const messagePayload = {
      id: 1,
      artifact_id: 'artifact-1',
      content: 'Привет',
      sender: 'alice',
      created_at: '2024-03-01T13:00:00Z',
      updated_at: '2024-03-01T13:00:00Z',
    };
    const fetchMock = mockFetch(messagePayload);
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'success',
      artifact: { ...sampleArtifact, messages: [] },
    });

    await useWorkspaceStore.getState().sendMessage({ content: 'Привет', sender: 'alice' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/chat/message',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifact_id: 'artifact-1',
          content: 'Привет',
          sender: 'alice',
        }),
      }),
    );
    const state = useWorkspaceStore.getState();
    expect(state.artifact?.messages).toHaveLength(1);
    expect(state.artifact?.messages[0].content).toBe('Привет');
  });

  it('creates a knowledge link through the API and stores it locally', async () => {
    const linkPayload = {
      id: 'link-1',
      source_entity_type: 'artifact',
      source_entity_id: 'artifact-1',
      target_entity_type: 'artifact',
      target_entity_id: 'artifact-2',
      link_type: 'relates_to',
      description: 'Связанные артефакты',
      created_at: '2024-03-01T14:00:00Z',
      updated_at: '2024-03-01T14:00:00Z',
    };
    const fetchMock = mockFetch(linkPayload);
    useWorkspaceStore.setState({
      currentArtifactId: 'artifact-1',
      artifactStatus: 'success',
      artifact: sampleArtifact,
      links: [],
    });

    await useWorkspaceStore
      .getState()
      .createLink({
        targetEntityId: 'artifact-2',
        targetEntityType: 'artifact',
        linkType: 'relates_to',
        description: 'Связанные артефакты',
      });

    expect(fetchMock).toHaveBeenCalledWith(
      '/artifacts/artifact-1/links',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_entity_id: 'artifact-2',
          target_entity_type: 'artifact',
          link_type: 'relates_to',
          description: 'Связанные артефакты',
        }),
      }),
    );
    const state = useWorkspaceStore.getState();
    expect(state.links).toHaveLength(1);
    expect(state.links[0].id).toBe('link-1');
  });
});
