import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, Loader2, Send } from 'lucide-react'
import { fetchAddressByCep, geocodeAddress } from '../api/cep'
import { createRegistration } from '../api/registrations'
import { handleUnauthorized } from '../context/AuthContext'
import { ApiError, type RegistrationPayload, type UserPrivateStation, type Visibility } from '../types'
import { BRAZILIAN_STATES, CHARGER_MODELS, formatCep, formatPhone, normalizeTime, onlyDigits } from '../lib/utils'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { CpfUserLookup, CpfUserMultiLookup } from '../components/CpfUserLookup'
import { LocationMap } from '../components/LocationMap'
import { RfidCodes } from '../components/RfidCodes'
import { useToast } from '../components/Toast'
import { Button, Field, Input, Section, Select, Textarea, Toggle } from '../components/ui'

const initialForm = {
  first_name: '',
  last_name: '',
  area_code: '',
  phone: '',
  email: '',
  address: '',
  house_number: '',
  address_complement: '',
  city: '',
  state: 'SC',
  zip_code: '',
  latitude: null as number | null,
  longitude: null as number | null,
  charger_model: '',
  charger_nickname: '',
  serial_number: '',
  visibility: 'public' as Visibility,
  wants_rfid_tag: false,
  available_24h: true,
  available_from: '',
  available_to: '',
  additional_info: '',
}

import { getAppConfig } from '../lib/config'

function getLicenseCode(): string {
  return getAppConfig().licenseCode
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Nome',
  last_name: 'Sobrenome',
  email: 'E-mail',
  area_code: 'DDD',
  phone: 'Telefone',
  address: 'Rua',
  house_number: 'Número',
  city: 'Cidade',
  state: 'Estado',
  zip_code: 'CEP',
  serial_number: 'Número de série',
  charger_model: 'Modelo',
  license: 'Licença',
  coords: 'Localização no mapa',
  available_from: 'Horário inicial',
  available_to: 'Horário final',
  owner: 'Proprietário',
  rfid: 'RFID',
}

function formatMissingFields(keys: string[]): string {
  const labels = keys.map((key) => FIELD_LABELS[key] ?? key)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`
}

export function RegistrationPage() {
  const toast = useToast()
  const [form, setForm] = useState(initialForm)
  const [rfidCodes, setRfidCodes] = useState<string[]>([])
  const [owner, setOwner] = useState<UserPrivateStation | null>(null)
  const [allowedUsers, setAllowedUsers] = useState<UserPrivateStation[]>([])
  const [cepLoading, setCepLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const lastResolvedCep = useRef('')
  const resolvingCep = useRef(false)

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onScan = useCallback((value: string) => {
    setForm((prev) => ({ ...prev, serial_number: value }))
  }, [])

  useEffect(() => {
    const zip = onlyDigits(form.zip_code)

    if (zip.length !== 8) {
      if (lastResolvedCep.current) {
        lastResolvedCep.current = ''
        setForm((prev) => ({
          ...prev,
          address: '',
          city: '',
          latitude: null,
          longitude: null,
        }))
      }
      return
    }

    if (zip === lastResolvedCep.current || resolvingCep.current) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        resolvingCep.current = true
        setCepLoading(true)
        try {
          const data = await fetchAddressByCep(zip)
          if (cancelled) return

          const address = data.logradouro || ''
          const city = data.localidade || ''
          const state = data.uf || 'SC'

          const coords = await geocodeAddress({
            address,
            house_number: '',
            city,
            state,
            zip_code: onlyDigits(data.cep),
          })
          if (cancelled) return

          lastResolvedCep.current = zip
          setForm((prev) => ({
            ...prev,
            zip_code: onlyDigits(data.cep),
            address,
            city,
            state,
            latitude: coords.latitude,
            longitude: coords.longitude,
          }))
        } catch {
          if (!cancelled) toast.fail()
        } finally {
          resolvingCep.current = false
          if (!cancelled) setCepLoading(false)
        }
      })()
    }, 350)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.zip_code, toast])

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!form.first_name.trim()) errors.first_name = 'Informe o nome'
    if (!form.last_name.trim()) errors.last_name = 'Informe o sobrenome'
    if (!form.email.trim()) errors.email = 'Informe o e-mail'
    if (onlyDigits(form.area_code).length < 2) errors.area_code = 'Informe um DDD válido'
    if (onlyDigits(form.phone).length < 8) errors.phone = 'Informe um telefone válido'
    if (!form.address.trim()) errors.address = 'Informe a rua'
    if (!form.house_number.trim()) errors.house_number = 'Informe o número'
    if (!form.city.trim()) errors.city = 'Informe a cidade'
    if (!form.state) errors.state = 'Informe o estado'
    if (onlyDigits(form.zip_code).length !== 8) errors.zip_code = 'Informe um CEP válido'
    if (!form.serial_number.trim()) errors.serial_number = 'Informe o número de série'
    if (!form.charger_model.trim()) errors.charger_model = 'Selecione o modelo'
    if (!getLicenseCode()) errors.license = 'Licença não configurada'
    if (form.latitude == null || form.longitude == null) {
      errors.coords = 'Busque o CEP e ajuste o pin no mapa'
    }
    if (!form.available_24h) {
      if (!normalizeTime(form.available_from)) errors.available_from = 'Informe o horário inicial'
      if (!normalizeTime(form.available_to)) errors.available_to = 'Informe o horário final'
    }
    if (form.visibility === 'private' && !owner) {
      errors.owner = 'Busque o CPF do proprietário'
    }
    if (form.wants_rfid_tag) {
      const valid = rfidCodes.map((c) => c.trim()).filter(Boolean)
      if (!valid.length) errors.rfid = 'Informe ao menos um código RFID'
    }

    setFieldErrors(errors)
    return errors
  }

  const buildPayload = (): RegistrationPayload => {
    const authorized_users =
      form.visibility === 'private' && owner
        ? [
            {
              user_pk: owner.user_pk,
              owner: true,
              bind_exists: false,
              bind_status: 'NOT_REQUESTED',
            },
            ...allowedUsers.map((user) => ({
              user_pk: user.user_pk,
              owner: false,
              bind_exists: false,
              bind_status: 'ACCEPTED',
            })),
          ]
        : []

    return {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      area_code: onlyDigits(form.area_code),
      phone: onlyDigits(form.phone),
      email: form.email.trim(),
      address: form.address.trim(),
      house_number: form.house_number.trim(),
      address_complement: form.address_complement.trim(),
      city: form.city.trim(),
      state: form.state,
      zip_code: onlyDigits(form.zip_code),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      charger_model: form.charger_model,
      charger_nickname: form.charger_nickname.trim(),
      serial_number: form.serial_number.trim(),
      visibility: form.visibility,
      authorized_emails: [],
      authorized_users,
      wants_rfid_tag: form.wants_rfid_tag,
      rfid_codes: form.wants_rfid_tag ? rfidCodes.map((c) => c.trim()).filter(Boolean) : [],
      available_24h: form.available_24h,
      available_from: form.available_24h ? '' : normalizeTime(form.available_from),
      available_to: form.available_24h ? '' : normalizeTime(form.available_to),
      license_code: getLicenseCode(),
      additional_info: form.additional_info.trim(),
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const errors = validate()
    const missing = Object.values(errors)
    if (missing.length) {
      toast.fail(
        missing.length === 1
          ? missing[0]
          : `Preencha os dados obrigatórios: ${formatMissingFields(Object.keys(errors))}`,
      )
      return
    }

    setSubmitting(true)
    try {
      const payload = buildPayload()
      const result = await createRegistration(payload)
      toast.success(result.message || 'Cadastrado com sucesso')
      setForm(initialForm)
      setRfidCodes([])
      setOwner(null)
      setAllowedUsers([])
      setFieldErrors({})
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        try {
          await handleUnauthorized()
        } catch {
          /* ignore */
        }
      }
      const apiMessage =
        err instanceof ApiError ? err.body.error || err.body.message || err.message : null
      toast.fail(apiMessage || undefined)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Nova estação</h1>
        <p className="mt-1 text-sm text-slate-500 sm:text-base">
          Preencha os dados do carregador.
        </p>
      </div>

      <Section title="Contato" description="Dados de quem será responsável pela estação.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" error={fieldErrors.first_name}>
            <Input value={form.first_name} onChange={(e) => set('first_name', e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Sobrenome" error={fieldErrors.last_name}>
            <Input value={form.last_name} onChange={(e) => set('last_name', e.target.value)} autoComplete="family-name" />
          </Field>
          <Field label="E-mail" error={fieldErrors.email} className="sm:col-span-2">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
          </Field>
          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Telefone</span>
            <div className="flex flex-nowrap items-stretch gap-2">
              <Input
                inputMode="numeric"
                placeholder="DDD"
                className="!w-16 shrink-0 grow-0 basis-16 px-2 text-center sm:!w-20 sm:basis-20"
                maxLength={3}
                value={form.area_code}
                onChange={(e) => set('area_code', onlyDigits(e.target.value).slice(0, 3))}
                aria-label="DDD"
              />
              <Input
                inputMode="numeric"
                placeholder="99999-9999"
                className="!w-auto min-w-0 flex-1"
                value={formatPhone(form.phone)}
                onChange={(e) => set('phone', onlyDigits(e.target.value).slice(0, 9))}
                aria-label="Número"
              />
            </div>
            {(fieldErrors.area_code || fieldErrors.phone) && (
              <span className="mt-1.5 block text-xs text-rose-600">
                {fieldErrors.area_code || fieldErrors.phone}
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section title="Endereço" description="Digite o CEP para preencher o endereço. Informe o número e o complemento.">
        <div className="grid gap-3 sm:grid-cols-6">
          <Field label="CEP" error={fieldErrors.zip_code} className="sm:col-span-3">
            <div className="relative">
              <Input
                inputMode="numeric"
                placeholder="88010-000"
                value={formatCep(form.zip_code)}
                onChange={(e) => set('zip_code', onlyDigits(e.target.value).slice(0, 8))}
              />
              {cepLoading && (
                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-600" />
              )}
            </div>
          </Field>
          <Field label="Estado" error={fieldErrors.state} className="sm:col-span-3">
            <Select value={form.state} disabled>
              {BRAZILIAN_STATES.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rua" error={fieldErrors.address} className="sm:col-span-6">
            <Input value={form.address} readOnly placeholder="Preenchido pelo CEP" />
          </Field>
          <Field label="Número" error={fieldErrors.house_number} className="sm:col-span-2">
            <Input
              value={form.house_number}
              onChange={(e) => set('house_number', e.target.value)}
              placeholder="100"
            />
          </Field>
          <Field label="Complemento" className="sm:col-span-4">
            <Input
              value={form.address_complement}
              onChange={(e) => set('address_complement', e.target.value)}
              placeholder="Casa, apto, sala…"
            />
          </Field>
          <Field label="Cidade" error={fieldErrors.city} className="sm:col-span-6">
            <Input value={form.city} readOnly placeholder="Preenchido pelo CEP" />
          </Field>
          <div className="sm:col-span-6">
            {fieldErrors.coords && <p className="mb-2 text-xs text-rose-600">{fieldErrors.coords}</p>}
            <LocationMap
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={({ latitude, longitude }) =>
                setForm((prev) => ({ ...prev, latitude, longitude }))
              }
            />
          </div>
        </div>
      </Section>

      <Section title="Carregador" description="Modelo e número de série únicos.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Modelo" error={fieldErrors.charger_model}>
            <Select value={form.charger_model} onChange={(e) => set('charger_model', e.target.value)}>
              <option value="">Escolha um modelo</option>
              {CHARGER_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Apelido">
            <Input
              value={form.charger_nickname}
              onChange={(e) => set('charger_nickname', e.target.value)}
              placeholder="Carregador Casa"
            />
          </Field>
          <Field label="Número de série" error={fieldErrors.serial_number} className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={form.serial_number}
                onChange={(e) => set('serial_number', e.target.value)}
                placeholder="SN-XXXXX-001"
                className="font-mono"
              />
              <Button type="button" variant="secondary" className="shrink-0 px-3" onClick={() => setScannerOpen(true)}>
                <Camera className="h-5 w-5" />
                <span className="hidden sm:inline">Escanear</span>
              </Button>
            </div>
          </Field>
        </div>
      </Section>

      <Section
        title="Visibilidade"
        description="Pública ou privada (com usuários autorizados que estão cadastrados no aplicativo Intelbras CVE)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(['public', 'private'] as Visibility[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                set('visibility', value)
                if (value === 'public') {
                  setOwner(null)
                  setAllowedUsers([])
                }
              }}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                form.visibility === value
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="font-semibold text-slate-900">{value === 'public' ? 'Pública' : 'Privada'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {value === 'public'
                  ? 'Acesso aberto para todos os usuários.'
                  : 'Acesso apenas aos usuários permitidos.'}
              </p>
            </button>
          ))}
        </div>

        {form.visibility === 'private' && (
          <div className="mt-4 space-y-3">
            {fieldErrors.owner && <p className="text-xs text-rose-600">{fieldErrors.owner}</p>}
            <CpfUserLookup
              label="Proprietário"
              description="Informe o CPF do proprietário da estação."
              selected={owner}
              onSelect={setOwner}
              excludeUserPks={allowedUsers.map((u) => u.user_pk)}
            />
            <CpfUserMultiLookup
              label="Acesso permitido"
              description="Adicione um ou mais usuários com acesso à estação."
              selected={allowedUsers}
              onChange={setAllowedUsers}
              excludeUserPks={owner ? [owner.user_pk] : []}
            />
          </div>
        )}
      </Section>

      <Section title="Disponibilidade">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  available_24h: true,
                  available_from: '',
                  available_to: '',
                }))
              }
              className={`rounded-xl border px-4 py-3 text-left transition ${
                form.available_24h
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="font-semibold text-slate-900">24 horas</p>
              <p className="mt-1 text-xs text-slate-500">Disponível o dia todo.</p>
            </button>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  available_24h: false,
                  available_from: prev.available_from || '08:00',
                  available_to: prev.available_to || '18:00',
                }))
              }
              className={`rounded-xl border px-4 py-3 text-left transition ${
                !form.available_24h
                  ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <p className="font-semibold text-slate-900">Horário específico</p>
              <p className="mt-1 text-xs text-slate-500">Definir abertura e fechamento.</p>
            </button>
          </div>

          {!form.available_24h && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Das" error={fieldErrors.available_from}>
                <Input
                  type="time"
                  step={60}
                  value={normalizeTime(form.available_from) || form.available_from}
                  onChange={(e) => set('available_from', normalizeTime(e.target.value) || e.target.value)}
                />
              </Field>
              <Field label="Até" error={fieldErrors.available_to}>
                <Input
                  type="time"
                  step={60}
                  value={normalizeTime(form.available_to) || form.available_to}
                  onChange={(e) => set('available_to', normalizeTime(e.target.value) || e.target.value)}
                />
              </Field>
            </div>
          )}
        </div>
      </Section>

      <Section title="RFID (opcional)">
        <div className="space-y-3">
          <Toggle
            checked={form.wants_rfid_tag}
            onChange={(v) => {
              set('wants_rfid_tag', v)
              if (v && rfidCodes.length === 0) setRfidCodes([''])
              if (!v) setRfidCodes([])
            }}
            label="Cadastrar Tags RFID"
          />
          {form.wants_rfid_tag && (
            <>
              {fieldErrors.rfid && <p className="text-xs text-rose-600">{fieldErrors.rfid}</p>}
              <RfidCodes codes={rfidCodes} onChange={setRfidCodes} />
            </>
          )}
        </div>
      </Section>

      <Section title="Observações">
        <Field label="Informações adicionais">
          <Textarea
            value={form.additional_info}
            onChange={(e) => set('additional_info', e.target.value)}
            placeholder="Detalhes extras sobre a instalação…"
          />
        </Field>
      </Section>

      <div className="sticky bottom-3 z-30">
        <Button type="submit" className="w-full py-3.5 text-base shadow-lg shadow-emerald-600/25" disabled={submitting}>
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {submitting ? 'Cadastrando…' : 'Cadastrar carregador'}
        </Button>
      </div>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={onScan} />
    </form>
  )
}
