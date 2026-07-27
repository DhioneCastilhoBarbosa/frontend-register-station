export type AppConfig = {
  apiUrl: string
  authEmail: string
  authPassword: string
  licenseCode: string
}

declare global {
  interface Window {
    __APP_CONFIG__?: Partial<{
      VITE_API_URL: string
      VITE_AUTH_EMAIL: string
      VITE_AUTH_PASSWORD: string
      VITE_LICENSE_CODE: string
    }>
  }
}

/** Lê config de runtime (Docker) com fallback para variáveis do Vite (dev/build). */
export function getAppConfig(): AppConfig {
  const runtime = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined

  const apiUrl = (
    runtime?.VITE_API_URL ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    ''
  ).replace(/\/$/, '')

  return {
    apiUrl: apiUrl || '/api',
    authEmail: (runtime?.VITE_AUTH_EMAIL || import.meta.env.VITE_AUTH_EMAIL || '').trim(),
    authPassword: (runtime?.VITE_AUTH_PASSWORD || import.meta.env.VITE_AUTH_PASSWORD || '').trim(),
    licenseCode: (runtime?.VITE_LICENSE_CODE || import.meta.env.VITE_LICENSE_CODE || '').trim(),
  }
}
