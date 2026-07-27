export type Visibility = 'public' | 'private'

export interface AuthorizedUser {
  user_pk: number
  owner: boolean
  bind_exists: boolean
  bind_status: 'NOT_REQUESTED' | 'ACCEPTED' | string
}

export interface RegistrationPayload {
  first_name: string
  last_name: string
  area_code: string
  phone: string
  email: string
  address: string
  house_number: string
  address_complement: string
  city: string
  state: string
  zip_code: string
  latitude: number
  longitude: number
  charger_model: string
  charger_nickname: string
  serial_number: string
  visibility: Visibility
  authorized_emails: string[]
  authorized_users: AuthorizedUser[]
  wants_rfid_tag: boolean
  rfid_codes: string[]
  available_24h: boolean
  available_from: string
  available_to: string
  license_code: string
  additional_info: string
}

export interface UserPrivateStation {
  email: string
  phone: string | null
  owner: boolean | null
  user_pk: number
  user_name: string
  doc_type: string
  doc_number: string
  ocpp_id_tag: string | null
  bind_status: string | null
  bind_exists: boolean
  tenant_name: string | null
  tenant_related: boolean
}

export interface UserByCpfResponse {
  error: string | null
  userPrivateStation: UserPrivateStation
}

export interface ApiErrorBody {
  error?: string
  message?: string
  registration_id?: number
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.error || body.message || `Erro HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}
