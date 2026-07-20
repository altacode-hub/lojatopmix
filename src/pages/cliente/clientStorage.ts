export type ClienteProfileDraft = {
  fullName: string
  email: string
  cpf: string
  phone: string
}

export type ClienteAddress = {
  id: string
  label: string
  recipient: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  zipCode: string
  reference: string
}

const getStorageKey = (userId: string, suffix: string) => `topmix_cliente_${suffix}_${userId}`

const safeRead = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return fallback
    }

    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const safeWrite = <T>(key: string, value: T) => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export const getClienteProfileDraft = (userId: string): ClienteProfileDraft =>
  safeRead<ClienteProfileDraft>(getStorageKey(userId, 'profile'), {
    fullName: '',
    email: '',
    cpf: '',
    phone: '',
  })

export const saveClienteProfileDraft = (userId: string, draft: ClienteProfileDraft) => {
  safeWrite(getStorageKey(userId, 'profile'), draft)
}

export const getClienteAddresses = (userId: string): ClienteAddress[] =>
  safeRead<ClienteAddress[]>(getStorageKey(userId, 'addresses'), [])

export const saveClienteAddresses = (userId: string, addresses: ClienteAddress[]) => {
  safeWrite(getStorageKey(userId, 'addresses'), addresses)
}

export const toUppercaseInput = (value: string) => value.toLocaleUpperCase('pt-BR')
