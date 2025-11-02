import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiClient } from '../api/client';

export const useArtifactData = () => {
  const { artifactId } = useParams<{ artifactId: string }>();
  const { data: artifact, ...rest } = useQuery({
    queryKey: ['artifacts', artifactId],
    queryFn: () => apiClient.getArtifactDetail(artifactId!),
    enabled: !!artifactId,
  });

  return { artifact, artifactId, ...rest };
};
