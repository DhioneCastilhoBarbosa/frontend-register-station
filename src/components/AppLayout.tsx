import { Outlet } from 'react-router-dom'
import { PlugZap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Alert, Button } from './ui'

export function AppLayout() {
  const { status, error, retry } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="font-medium text-slate-800">Conectando…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Falha na autenticação</h1>
          <Alert variant="error">Falha. Tente novamente mais tarde.</Alert>
          {import.meta.env.DEV && error && (
            <p className="text-xs text-slate-400">{error}</p>
          )}
          <Button type="button" className="w-full" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f1f5f9_45%,_#e2e8f0_100%)]">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
            <PlugZap className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">Cadastro de Carregador</p>
            <p className="truncate text-xs text-slate-500">Aplicativo Intelbras CVE</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5 pb-10 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}
