import { useEffect } from 'react';
import { useWorkspaceStore } from './workspaceStore';

export const useArtifactData = () => {
  const artifact = useWorkspaceStore((state) => state.artifact);
  const status = useWorkspaceStore((state) => state.artifactStatus);
  const error = useWorkspaceStore((state) => state.artifactError);
  const currentArtifactId = useWorkspaceStore((state) => state.currentArtifactId);
  const loadArtifact = useWorkspaceStore((state) => state.loadArtifact);

  useEffect(() => {
    if (!currentArtifactId) {
      return;
    }

    if (status === 'idle') {
      void loadArtifact(currentArtifactId);
      return;
    }

    if (!artifact || artifact.id !== currentArtifactId) {
      void loadArtifact(currentArtifactId);
    }
  }, [artifact, currentArtifactId, status, loadArtifact]);

  return { artifact, status, error, currentArtifactId };
};
