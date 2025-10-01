import { create } from 'zustand';
import { apiClient, ArtifactDetailResponse, ChatMessageResponse, LinkResponse } from '../api/client';
import { DEFAULT_ARTIFACT_ID } from '../config';

type ThemeMode = 'light' | 'dark';

type ArtifactStatus = 'idle' | 'loading' | 'success' | 'error';

type SendMessageInput = {
  content: string;
  sender?: string;
};

type CreateLinkInput = {
  targetEntityType: string;
  targetEntityId: string;
  linkType: string;
  description?: string;
};

type WorkspaceState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  currentArtifactId: string | null;
  artifact: ArtifactDetailResponse | null;
  artifactStatus: ArtifactStatus;
  artifactError: string | null;
  links: LinkResponse[];
  loadArtifact: (artifactId: string) => Promise<void>;
  sendMessage: (input: SendMessageInput) => Promise<ChatMessageResponse>;
  createLink: (input: CreateLinkInput) => Promise<LinkResponse>;
  resetLinks: () => void;
};

const initialArtifactId = DEFAULT_ARTIFACT_ID || null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
  currentArtifactId: initialArtifactId,
  artifact: null,
  artifactStatus: 'idle',
  artifactError: null,
  links: [],
  resetLinks: () => set({ links: [] }),
  loadArtifact: async (artifactId: string) => {
    if (!artifactId) {
      set({
        currentArtifactId: null,
        artifact: null,
        artifactStatus: 'idle',
        artifactError: null,
      });
      return;
    }

    set({
      currentArtifactId: artifactId,
      artifactStatus: 'loading',
      artifactError: null,
      links: [],
    });

    try {
      const artifact = await apiClient.getArtifactDetail(artifactId);
      set({ artifact, artifactStatus: 'success', artifactError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load artifact';
      set({ artifact: null, artifactStatus: 'error', artifactError: message });
    }
  },
  sendMessage: async ({ content, sender }: SendMessageInput) => {
    const { currentArtifactId, artifact } = get();
    if (!currentArtifactId) {
      throw new Error('No artifact selected');
    }
    const payload = await apiClient.postChatMessage({
      artifact_id: currentArtifactId,
      content,
      sender,
    });
    if (artifact) {
      set({
        artifact: {
          ...artifact,
          messages: [...artifact.messages, payload],
        },
      });
    }
    return payload;
  },
  createLink: async ({ targetEntityId, targetEntityType, linkType, description }: CreateLinkInput) => {
    const { currentArtifactId } = get();
    if (!currentArtifactId) {
      throw new Error('No artifact selected');
    }
    const link = await apiClient.createLink(currentArtifactId, {
      target_entity_id: targetEntityId,
      target_entity_type: targetEntityType,
      link_type: linkType,
      description,
    });
    set((state) => ({ links: [...state.links, link] }));
    return link;
  },
}));
