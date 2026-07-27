export interface ViaCepResult {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export interface GeocodeResult {
  latitude: number
  longitude: number
}

export async function fetchAddressByCep(cep: string): Promise<ViaCepResult> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) {
    throw new Error('CEP deve ter 8 dígitos')
  }

  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
  if (!response.ok) {
    throw new Error('Falha ao consultar CEP')
  }

  const data = (await response.json()) as ViaCepResult
  if (data.erro) {
    throw new Error('CEP não encontrado')
  }

  return data
}

/** Geocoding via Nominatim (OpenStreetMap) — sem chave de API. */
export async function geocodeAddress(params: {
  address: string
  house_number: string
  city: string
  state: string
  zip_code: string
}): Promise<GeocodeResult> {
  const query = [
    params.house_number,
    params.address,
    params.city,
    params.state,
    params.zip_code,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Falha ao obter coordenadas')
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>
  if (!results.length) {
    throw new Error('Não foi possível geocodificar o endereço')
  }

  return {
    latitude: Number(results[0].lat),
    longitude: Number(results[0].lon),
  }
}
