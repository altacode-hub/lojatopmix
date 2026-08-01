import { get, ref, set } from 'firebase/database'
import { rtdb } from '../../service/firebase'

export type ClienteProfileDraft = {
  fullName: string
  email: string
  cpf: string
  phone: string
}

export type ClienteCheckoutAddressDraft = {
  cep: string
  number: string
  complement: string
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

const emptyClienteAddress = (): ClienteAddress => ({
  id: '',
  label: '',
  recipient: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  zipCode: '',
  reference: '',
})

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

export const getClienteAddresses = (userId: string): ClienteAddress[] =>
  safeRead<ClienteAddress[]>(getStorageKey(userId, 'addresses'), [])

const isPersistentUserId = (userId: string) => Boolean(userId && userId !== 'anonimo')

const normalizeClienteAddress = (
  address: Partial<ClienteAddress> | null | undefined,
  fallbackId?: string,
): ClienteAddress | null => {
  if (!address) {
    return null
  }

  const baseAddress = emptyClienteAddress()
  const normalizedAddress = {
    ...baseAddress,
    ...address,
    id: typeof address.id === 'string' && address.id.trim() ? address.id : fallbackId || '',
  }

  return normalizedAddress.id ? normalizedAddress : null
}

const normalizeClienteAddresses = (value: unknown): ClienteAddress[] => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
      .map((address) => normalizeClienteAddress(address as Partial<ClienteAddress>))
      .filter((address): address is ClienteAddress => Boolean(address))
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, Partial<ClienteAddress>>)
      .map(([addressId, address]) => normalizeClienteAddress(address, addressId))
      .filter((address): address is ClienteAddress => Boolean(address))
  }

  return []
}

const serializeClienteAddresses = (addresses: ClienteAddress[]) =>
  addresses.reduce<Record<string, Omit<ClienteAddress, 'id'>>>((acc, address) => {
    acc[address.id] = {
      label: address.label,
      recipient: address.recipient,
      street: address.street,
      number: address.number,
      complement: address.complement,
      district: address.district,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      reference: address.reference,
    }

    return acc
  }, {})

export const loadClienteAddresses = async (userId: string): Promise<ClienteAddress[]> => {
  const cachedAddresses = getClienteAddresses(userId)

  if (!isPersistentUserId(userId)) {
    return cachedAddresses
  }

  try {
    const snapshot = await get(ref(rtdb, `clientes/${userId}/enderecos`))
    const databaseAddresses = normalizeClienteAddresses(snapshot.exists() ? snapshot.val() : null)

    safeWrite(getStorageKey(userId, 'addresses'), databaseAddresses)
    return databaseAddresses
  } catch {
    return cachedAddresses
  }
}

export const saveClienteAddresses = async (userId: string, addresses: ClienteAddress[]) => {
  const normalizedAddresses = normalizeClienteAddresses(addresses)

  safeWrite(getStorageKey(userId, 'addresses'), normalizedAddresses)

  if (!isPersistentUserId(userId)) {
    return
  }

  await set(ref(rtdb, `clientes/${userId}/enderecos`), serializeClienteAddresses(normalizedAddresses))
}

const normalizeCheckoutAddress = (
  address: Partial<ClienteCheckoutAddressDraft> | null | undefined,
): ClienteCheckoutAddressDraft | null => {
  if (!address) {
    return null
  }

  const normalizedAddress = {
    cep: typeof address.cep === 'string' ? address.cep : '',
    number: typeof address.number === 'string' ? address.number : '',
    complement: typeof address.complement === 'string' ? address.complement : '',
  }

  return normalizedAddress.cep || normalizedAddress.number || normalizedAddress.complement ? normalizedAddress : null
}

export const getClienteCheckoutAddress = (userId: string): ClienteCheckoutAddressDraft | null =>
  normalizeCheckoutAddress(safeRead<ClienteCheckoutAddressDraft | null>(getStorageKey(userId, 'checkout_address'), null))

export const loadClienteCheckoutAddress = async (userId: string): Promise<ClienteCheckoutAddressDraft | null> => {
  try {
    const snapshot = await get(ref(rtdb, `clientes/${userId}/ultimoEnderecoCheckout`))
    const databaseAddress = normalizeCheckoutAddress(
      snapshot.exists() ? (snapshot.val() as Partial<ClienteCheckoutAddressDraft>) : null,
    )

    if (databaseAddress) {
      safeWrite(getStorageKey(userId, 'checkout_address'), databaseAddress)
      return databaseAddress
    }
  } catch {
    // Se a leitura do banco falhar, usa o valor local para nao bloquear o checkout.
  }

  return getClienteCheckoutAddress(userId)
}

export const saveClienteCheckoutAddress = async (userId: string, address: ClienteCheckoutAddressDraft) => {
  const normalizedAddress = normalizeCheckoutAddress(address)

  if (!normalizedAddress) {
    return
  }

  safeWrite(getStorageKey(userId, 'checkout_address'), normalizedAddress)
  await set(ref(rtdb, `clientes/${userId}/ultimoEnderecoCheckout`), normalizedAddress)
}

export const toUppercaseInput = (value: string) => value.toLocaleUpperCase('pt-BR')
