import { API_BASE_URL } from '../config';

export type ChatMessageRequest = {
  artifact_id: string;
  content: string;
  sender?: string;
};

export type ChatMessageResponse = {
  id: number;
  artifact_id: string;
  content: string;
  sender?: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactChildSummary = {
  id: string;
  title: string;
};

export type StructuredEntryResponse = {
  id: string;
  artifact_id: string;
  data_json: Record<string, unknown>;
  text_representation: string;
  schema_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ArtifactDetailResponse = {
  id: string;
  title: string;
  summary: string;
  parent_artifact_id: string | null;
  children: ArtifactChildSummary[];
  messages: ChatMessageResponse[];
  structured_entries: StructuredEntryResponse[];
};

export type LinkCreateRequest = {
  target_entity_type: string;
  target_entity_id: string;
  link_type: string;
  description?: string;
};

export type LinkResponse = {
  id: string;
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  link_type: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
};

const withJsonDefaults = (init: RequestInit = {}): RequestInit => ({
  ...init,
  headers: {
    'Content-Type': 'application/json',
    ...(init.headers ?? {}),
  },
});

const parseResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const data = await parseResponse(response);

  if (!response.ok) {
    const detail = typeof data === 'object' && data !== null ? (data as { detail?: string }).detail : undefined;
    throw new Error(detail ?? response.statusText ?? 'Request failed');
  }

  return data as T;
};

export const apiClient = {
  getArtifactDetail: (artifactId: string) =>
    request<ArtifactDetailResponse>(`/artifacts/${artifactId}`),
  postChatMessage: (payload: ChatMessageRequest) =>
    request<ChatMessageResponse>('/chat/message', withJsonDefaults({ method: 'POST', body: JSON.stringify(payload) })),
  createLink: (artifactId: string, payload: LinkCreateRequest) =>
    request<LinkResponse>(
      `/artifacts/${artifactId}/links`,
      withJsonDefaults({ method: 'POST', body: JSON.stringify(payload) }),
    ),
};
