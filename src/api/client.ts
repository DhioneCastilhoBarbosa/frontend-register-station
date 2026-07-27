import { ApiError, type ApiErrorBody } from '../types'
import { getAppConfig } from '../lib/config'

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
  if (token) {
    sessionStorage.setItem('cve_panel_token', token)
  } else {
    sessionStorage.removeItem('cve_panel_token')
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  const stored = sessionStorage.getItem('cve_panel_token')
  if (stored) {
    accessToken = stored
  }
  return accessToken
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  auth?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers: customHeaders, ...rest } = options
  const { apiUrl } = getAppConfig()

  const headers = new Headers(customHeaders)
  if (!headers.has('Content-Type') && body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth) {
    const token = getAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  let response: Response
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Não foi possível conectar à API. Tente novamente mais tarde.')
  }

  const text = await response.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { message: text }
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, (parsed as ApiErrorBody) || { message: `Erro HTTP ${response.status}` })
  }

  return parsed as T
}

export function getApiUrl() {
  return getAppConfig().apiUrl
}

export { getApiUrl as API_URL }
