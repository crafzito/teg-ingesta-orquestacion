/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_HTTP_ORIGIN?: string
  readonly VITE_BACKEND_WS_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
