import { apiRequest, setAccessToken } from './client'

interface LoginResponse {
  token: string
}

/** Login silencioso com credenciais do .env (VITE_AUTH_EMAIL / VITE_AUTH_PASSWORD). */
export async function silentLogin(): Promise<string> {
  const email = import.meta.env.VITE_AUTH_EMAIL as string | undefined
  const password = import.meta.env.VITE_AUTH_PASSWORD as string | undefined

  if (!email || !password) {
    throw new Error('Configure VITE_AUTH_EMAIL e VITE_AUTH_PASSWORD no arquivo .env')
  }

  const data = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })

  setAccessToken(data.token)
  return data.token
}
