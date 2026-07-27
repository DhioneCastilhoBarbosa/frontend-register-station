import { apiRequest } from './client'
import type { RegistrationPayload, UserByCpfResponse } from '../types'

export async function getUserByCpf(cpf: string): Promise<UserByCpfResponse> {
  const digits = cpf.replace(/\D/g, '')
  return apiRequest<UserByCpfResponse>(`/users/by-cpf/${digits}`)
}

export async function createRegistration(payload: RegistrationPayload) {
  return apiRequest<{ message: string }>('/registrations', {
    method: 'POST',
    body: payload,
  })
}
