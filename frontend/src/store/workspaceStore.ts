import { create } from 'zustand';

type Artifact = {
  id: string;
  title: string;
  summary: string;
  status: 'draft' | 'published';
};

type ThreadEntry = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type GraphLink = {
  id: string;
  label: string;
  targetId: string;
  targetLabel: string;
};

type GraphNode = {
  id: string;
  label: string;
  kind: 'artifact' | 'schema' | 'entry';
  links: GraphLink[];
};

type ThemeMode = 'light' | 'dark';

type WorkspaceState = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  recentArtifacts: Artifact[];
  activeThread: ThreadEntry[];
  graphSnapshot: GraphNode[];
};

const initialState = {
  theme: 'light' as ThemeMode,
  recentArtifacts: [
    {
      id: 'a-1',
      title: 'Onboarding flow',
      summary: 'Tasks and insights for new contributors to Live Knowledge.',
      status: 'published' as const,
    },
    {
      id: 'a-2',
      title: 'Vector search experiments',
      summary: 'Notes about pgvector tuning and embedding strategies.',
      status: 'draft' as const,
    },
  ],
  activeThread: [
    {
      id: 'm-1',
      role: 'user' as const,
      content: 'How do we structure the schema for AI-generated entries?',
    },
    {
      id: 'm-2',
      role: 'assistant' as const,
      content: 'Start with a flexible JSON schema and iterate with validations.',
    },
  ],
  graphSnapshot: [
    {
      id: 'g-1',
      label: 'Onboarding flow',
      kind: 'artifact' as const,
      links: [
        { id: 'l-1', label: 'references', targetId: 'g-2', targetLabel: 'Contributor checklist' },
      ],
    },
    {
      id: 'g-2',
      label: 'Contributor checklist',
      kind: 'schema' as const,
      links: [],
    },
  ],
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),
}));
