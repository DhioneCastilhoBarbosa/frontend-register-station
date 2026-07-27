import { apiRequest, setAccessToken } from './client'
import { getAppConfig } from '../lib/config'

interface LoginResponse {
  token: string
}

/** Login silencioso com credenciais do .env / runtime (Docker). */
export async function silentLogin(): Promise<string> {
  const { authEmail, authPassword } = getAppConfig()

  if (!authEmail || !authPassword) {
    throw new Error('Credenciais não configuradas (VITE_AUTH_EMAIL / VITE_AUTH_PASSWORD)')
  }

  const data = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: authEmail, password: authPassword },
  })

  setAccessToken(data.token)
  return data.token
}
