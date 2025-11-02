import { Button, Modal, NavLink, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient, ArtifactSummaryResponse } from '../api/client';

interface ArtifactNode extends ArtifactSummaryResponse {
  children: ArtifactNode[];
}

const buildTree = (artifacts: ArtifactSummaryResponse[]): ArtifactNode[] => {
  const artifactMap = new Map<string, ArtifactNode>();
  const rootNodes: ArtifactNode[] = [];

  artifacts.forEach((artifact) => {
    artifactMap.set(artifact.id, { ...artifact, children: [] });
  });

  artifacts.forEach((artifact) => {
    if (artifact.parent_artifact_id && artifactMap.has(artifact.parent_artifact_id)) {
      artifactMap.get(artifact.parent_artifact_id)!.children.push(artifactMap.get(artifact.id)!);
    } else {
      rootNodes.push(artifactMap.get(artifact.id)!);
    }
  });

  return rootNodes;
};

const renderArtifactNode = (node: ArtifactNode) => (
  <NavLink
    key={node.id}
    component={Link}
    to={`/artifacts/${node.id}`}
    label={node.title}
  >
    {node.children.map(renderArtifactNode)}
  </NavLink>
);


export const ArtifactSidebar = () => {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [newArtifactTitle, setNewArtifactTitle] = useState('');

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['artifacts'],
    queryFn: apiClient.listArtifacts,
  });

  const mutation = useMutation({
    mutationFn: apiClient.createArtifact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artifacts'] });
      setNewArtifactTitle('');
      close();
    },
  });

  const handleCreateRootArtifact = () => {
    mutation.mutate({ title: newArtifactTitle });
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const artifactTree = buildTree(artifacts || []);

  return (
    <>
      <Modal opened={opened} onClose={close} title="New Artifact">
        <TextInput
          placeholder="Artifact title"
          value={newArtifactTitle}
          onChange={(event) => setNewArtifactTitle(event.currentTarget.value)}
          data-autofocus
        />
        <Button onClick={handleCreateRootArtifact} fullWidth mt="md">
          Create
        </Button>
      </Modal>

      <Button onClick={open} fullWidth>
        New Artifact
      </Button>
      {artifactTree.map(renderArtifactNode)}
    </>
  );
};
