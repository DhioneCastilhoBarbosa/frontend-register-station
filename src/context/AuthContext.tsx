import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { silentLogin } from '../api/auth'
import { getAccessToken, setAccessToken } from '../api/client'
import { ApiError } from '../types'

type AuthStatus = 'loading' | 'authenticated' | 'error'

interface AuthContextValue {
  status: AuthStatus
  error: string | null
  retry: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  const authenticate = useCallback(async () => {
    setStatus('loading')
    setError(null)

    try {
      const existing = getAccessToken()
      if (existing) {
        setStatus('authenticated')
        return
      }

      await silentLogin()
      setStatus('authenticated')
    } catch (err) {
      setAccessToken(null)

      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('Conta aguardando liberação de acesso. Solicite habilitação no banco.')
        } else if (err.status === 401) {
          setError('Credenciais do .env inválidas (e-mail ou senha).')
        } else {
          setError(err.message)
        }
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Falha ao autenticar na API. Confira se a API está no ar e o .env.')
      }

      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void authenticate()
  }, [authenticate])

  const value = useMemo(
    () => ({
      status,
      error,
      retry: () => {
        setAccessToken(null)
        void authenticate()
      },
    }),
    [status, error, authenticate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}

/** Em 401: limpa token e força novo login silencioso. */
export async function handleUnauthorized() {
  setAccessToken(null)
  await silentLogin()
}
