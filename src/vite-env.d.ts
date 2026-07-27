/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_AUTH_EMAIL: string
  readonly VITE_AUTH_PASSWORD: string
  readonly VITE_LICENSE_CODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
