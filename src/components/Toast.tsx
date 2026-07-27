import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

type ToastVariant = 'success' | 'error'

interface Toast {
  id: number
  variant: ToastVariant
  message: string
}

interface ToastContextValue {
  notify: (variant: ToastVariant, message: string) => void
  success: (message?: string) => void
  fail: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++toastId
      setToasts((prev) => [...prev, { id, variant, message }])
      window.setTimeout(() => dismiss(id), 4500)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (message = 'Cadastrado com sucesso') => notify('success', message),
      fail: () => notify('error', 'Falha. Tente novamente mais tarde.'),
    }),
    [notify],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur animate-[slideIn_0.25s_ease-out]',
              toast.variant === 'success'
                ? 'border-emerald-200 bg-emerald-50/95 text-emerald-950'
                : 'border-rose-200 bg-rose-50/95 text-rose-950',
            )}
            role="status"
          >
            {toast.variant === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            )}
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 opacity-60 hover:opacity-100"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
