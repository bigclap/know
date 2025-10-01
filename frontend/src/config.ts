const env = import.meta.env;

export const API_BASE_URL = env.VITE_API_BASE_URL ?? '';
export const DEFAULT_ARTIFACT_ID = env.VITE_DEFAULT_ARTIFACT_ID ?? '';
