import { useState } from 'react'
import { Search, UserCheck, X } from 'lucide-react'
import { getUserByCpf } from '../api/registrations'
import type { UserPrivateStation } from '../types'
import { formatCpf, onlyDigits } from '../lib/utils'
import { useToast } from './Toast'
import { Button, Field, Input } from './ui'

function UserCard({
  user,
  onRemove,
}: {
  user: UserPrivateStation
  onRemove: () => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <p className="truncate font-medium text-emerald-950">{user.user_name}</p>
          <p className="truncate text-sm text-emerald-800">{user.email}</p>
          <p className="mt-1 text-xs text-emerald-700">CPF {formatCpf(user.doc_number)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1.5 text-emerald-700 hover:bg-emerald-100"
        aria-label="Remover"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

interface CpfLookupBaseProps {
  label: string
  description?: string
  excludeUserPks?: number[]
}

export function CpfUserLookup({
  label,
  description,
  selected,
  onSelect,
  excludeUserPks = [],
}: CpfLookupBaseProps & {
  selected: UserPrivateStation | null
  onSelect: (user: UserPrivateStation | null) => void
}) {
  const toast = useToast()
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    const digits = onlyDigits(cpf)
    if (digits.length !== 11) {
      toast.fail()
      return
    }

    setLoading(true)
    try {
      const result = await getUserByCpf(digits)
      const user = result.userPrivateStation

      if (excludeUserPks.includes(user.user_pk)) {
        toast.fail()
        return
      }

      onSelect(user)
      setCpf('')
    } catch {
      toast.fail()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>

      {selected ? (
        <UserCard user={selected} onRemove={() => onSelect(null)} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Field label="CPF" className="flex-1">
            <Input
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={formatCpf(cpf)}
              onChange={(e) => setCpf(onlyDigits(e.target.value).slice(0, 11))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void lookup()
                }
              }}
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={loading}
              onClick={() => void lookup()}
            >
              <Search className="h-4 w-4" />
              {loading ? 'Buscando…' : 'Buscar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CpfUserMultiLookup({
  label,
  description,
  selected,
  onChange,
  excludeUserPks = [],
}: CpfLookupBaseProps & {
  selected: UserPrivateStation[]
  onChange: (users: UserPrivateStation[]) => void
}) {
  const toast = useToast()
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    const digits = onlyDigits(cpf)
    if (digits.length !== 11) {
      toast.fail()
      return
    }

    setLoading(true)
    try {
      const result = await getUserByCpf(digits)
      const user = result.userPrivateStation

      if (excludeUserPks.includes(user.user_pk) || selected.some((u) => u.user_pk === user.user_pk)) {
        toast.fail()
        return
      }

      onChange([...selected, user])
      setCpf('')
    } catch {
      toast.fail()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>

      {selected.length > 0 && (
        <div className="space-y-2">
          {selected.map((user) => (
            <UserCard
              key={user.user_pk}
              user={user}
              onRemove={() => onChange(selected.filter((u) => u.user_pk !== user.user_pk))}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Field label="CPF" className="flex-1">
          <Input
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={formatCpf(cpf)}
            onChange={(e) => setCpf(onlyDigits(e.target.value).slice(0, 11))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void lookup()
              }
            }}
          />
        </Field>
        <div className="flex items-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => void lookup()}
          >
            <Search className="h-4 w-4" />
            {loading ? 'Buscando…' : 'Adicionar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
