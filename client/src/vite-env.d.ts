/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, e.g. `/api/v1` in development or a full origin in production. */
  readonly VITE_API_URL?: string;
  /** Dev-server proxy target for `/api`. Not used in production builds. */
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
