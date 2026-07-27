export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function formatCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function formatCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  return d.replace(/(\d{5})(\d)/, '$1-$2')
}

export function formatPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 9)
  if (d.length <= 5) return d
  return `${d.slice(0, d.length - 4)}-${d.slice(-4)}`
}

/** Normaliza horário de input type="time" (pode vir HH:MM ou HH:MM:SS) para HH:MM. */
export function normalizeTime(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?/)
  if (!match) return ''
  const hours = match[1].padStart(2, '0')
  const minutes = match[2]
  return `${hours}:${minutes}`
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const

export const CHARGER_MODELS = [
  'EVE 0074C City',
  'EVE 0110C City',
  'EVE 0074B Business',
  'EVE 0220B Business',
] as const
