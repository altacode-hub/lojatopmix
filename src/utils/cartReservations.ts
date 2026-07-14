import { get, ref, runTransaction, update } from 'firebase/database'
import { rtdb } from '../service/firebase'

type CartReservationItemRecord = {
  itemId: string
  productId: string
  variationKey: string
  quantity: number
  updatedAt: number
}

type CartReservationItemsMap = Record<string, CartReservationItemRecord>

type AdjustCartReservationInput = {
  cartId: string
  itemId: string
  productId: string
  variationKey: string
  quantity: number
}

const CART_ID_STORAGE_KEY = 'topmix_cart_id'
const CATALOG_SYNC_PATH = 'indexes/catalogSync'

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const hasDefinedProperty = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key) && value[key] != null

const getInventoryAvailable = (inventory: Record<string, unknown>) => {
  if (hasDefinedProperty(inventory, 'available')) {
    return toNumber(inventory.available)
  }

  const total = toNumber(inventory.total)
  const reserved = toNumber(inventory.reserved)
  return Math.max(total - reserved, 0)
}

const buildCartId = () => {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const readCartReservationItems = (value: unknown): CartReservationItemsMap => {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<CartReservationItemsMap>((acc, [itemId, itemValue]) => {
    if (!itemValue || typeof itemValue !== 'object') {
      return acc
    }

    const record = itemValue as Partial<CartReservationItemRecord>
    const productId = typeof record.productId === 'string' ? record.productId : ''
    const variationKey = typeof record.variationKey === 'string' ? record.variationKey : ''

    if (!productId || !variationKey) {
      return acc
    }

    acc[itemId] = {
      itemId,
      productId,
      variationKey,
      quantity: toNumber(record.quantity),
      updatedAt: toNumber(record.updatedAt),
    }
    return acc
  }, {})
}

const rollbackInventoryCartReservation = async (productId: string, quantity: number) => {
  if (quantity <= 0) return

  await runTransaction(
    ref(rtdb, `inventory/${productId}`),
    (currentValue) => {
      const currentRecord =
        currentValue && typeof currentValue === 'object' ? { ...(currentValue as Record<string, unknown>) } : {}
      const nextCartReserved = Math.max(toNumber(currentRecord.cartReserved) - quantity, 0)

      return {
        ...currentRecord,
        cartReserved: nextCartReserved,
      }
    },
    { applyLocally: false },
  )
}

const rollbackVariationCartReservation = async (productId: string, variationKey: string, quantity: number) => {
  if (quantity <= 0) return

  await runTransaction(
    ref(rtdb, `showcase/${productId}/variations/${variationKey}`),
    (currentValue) => {
      if (!currentValue || typeof currentValue !== 'object') {
        return currentValue
      }

      const currentVariation = { ...(currentValue as Record<string, unknown>) }
      const nextCartReserved = Math.max(toNumber(currentVariation.cartReserved) - quantity, 0)

      return {
        ...currentVariation,
        cartReserved: nextCartReserved,
      }
    },
    { applyLocally: false },
  )
}

const persistCartReservationRecord = async ({
  cartId,
  itemId,
  productId,
  variationKey,
  quantity,
  nextVariationCartReserved,
  source,
}: AdjustCartReservationInput & {
  nextVariationCartReserved: number
  source: string
}) => {
  const now = Date.now()
  const updates: Record<string, unknown> = {
    [`cartReservations/${cartId}/updatedAt`]: now,
    [`cartReservations/${cartId}/status`]: 'active',
    [`products/${productId}/variations/${variationKey}/cartReserved`]: nextVariationCartReserved,
    [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
    [`${CATALOG_SYNC_PATH}/source`]: source,
  }

  if (quantity > 0) {
    updates[`cartReservations/${cartId}/items/${itemId}`] = {
      itemId,
      productId,
      variationKey,
      quantity,
      updatedAt: now,
    } satisfies CartReservationItemRecord
  } else {
    updates[`cartReservations/${cartId}/items/${itemId}`] = null
  }

  await update(ref(rtdb), updates)
}

export const getOrCreateCartId = () => {
  if (typeof window === 'undefined') {
    return buildCartId()
  }

  const existingCartId = window.localStorage.getItem(CART_ID_STORAGE_KEY)?.trim()
  if (existingCartId) {
    return existingCartId
  }

  const nextCartId = buildCartId()
  window.localStorage.setItem(CART_ID_STORAGE_KEY, nextCartId)
  return nextCartId
}

export const reserveCartItem = async ({
  cartId,
  itemId,
  productId,
  variationKey,
  quantity,
}: AdjustCartReservationInput) => {
  if (quantity <= 0) {
    return
  }

  const cartItemsSnapshot = await get(ref(rtdb, `cartReservations/${cartId}/items`))
  const cartItems = readCartReservationItems(cartItemsSnapshot.val())
  const currentItemReservation = toNumber(cartItems[itemId]?.quantity)

  let nextVariationCartReserved = 0
  let variationReservedApplied = false
  let inventoryReservedApplied = false

  try {
    const variationReservation = await runTransaction(
      ref(rtdb, `showcase/${productId}/variations/${variationKey}`),
      (currentValue) => {
        if (!currentValue || typeof currentValue !== 'object') {
          return currentValue
        }

        const currentVariation = { ...(currentValue as Record<string, unknown>) }
        const stock = toNumber(currentVariation.stock)
        const cartReserved = toNumber(currentVariation.cartReserved)
        const effectiveAvailable = stock - Math.max(cartReserved - currentItemReservation, 0)

        if (effectiveAvailable < quantity) {
          return
        }

        nextVariationCartReserved = cartReserved + quantity
        return {
          ...currentVariation,
          cartReserved: nextVariationCartReserved,
        }
      },
      { applyLocally: false },
    )

    if (!variationReservation.committed) {
      throw new Error('Esta variacao nao possui quantidade disponivel para reserva no carrinho.')
    }

    variationReservedApplied = true

    const inventoryReservation = await runTransaction(
      ref(rtdb, `inventory/${productId}`),
      (currentValue) => {
        const currentInventory =
          currentValue && typeof currentValue === 'object' ? { ...(currentValue as Record<string, unknown>) } : {}
        const available = getInventoryAvailable(currentInventory)
        const cartReserved = toNumber(currentInventory.cartReserved)

        return {
          ...currentInventory,
          available,
          cartReserved: cartReserved + quantity,
        }
      },
      { applyLocally: false },
    )

    if (!inventoryReservation.committed) {
      throw new Error('Nao foi possivel registrar a reserva deste produto no carrinho.')
    }

    inventoryReservedApplied = true

    await persistCartReservationRecord({
      cartId,
      itemId,
      productId,
      variationKey,
      quantity: currentItemReservation + quantity,
      nextVariationCartReserved,
      source: 'reserva_carrinho',
    })
  } catch (error) {
    if (inventoryReservedApplied) {
      await rollbackInventoryCartReservation(productId, quantity)
    }

    if (variationReservedApplied) {
      await rollbackVariationCartReservation(productId, variationKey, quantity)
    }

    throw error
  }
}

export const releaseCartItem = async ({
  cartId,
  itemId,
  productId,
  variationKey,
  quantity,
}: AdjustCartReservationInput) => {
  if (quantity <= 0) {
    return
  }

  const cartItemsSnapshot = await get(ref(rtdb, `cartReservations/${cartId}/items`))
  const cartItems = readCartReservationItems(cartItemsSnapshot.val())
  const currentItemReservation = toNumber(cartItems[itemId]?.quantity)

  if (currentItemReservation <= 0) {
    return
  }

  const releaseQuantity = Math.min(quantity, currentItemReservation)
  const nextItemQuantity = Math.max(currentItemReservation - releaseQuantity, 0)
  let nextVariationCartReserved = 0
  let variationReleased = false
  let inventoryReleased = false

  try {
    const variationRelease = await runTransaction(
      ref(rtdb, `showcase/${productId}/variations/${variationKey}`),
      (currentValue) => {
        if (!currentValue || typeof currentValue !== 'object') {
          return currentValue
        }

        const currentVariation = { ...(currentValue as Record<string, unknown>) }
        const cartReserved = toNumber(currentVariation.cartReserved)
        nextVariationCartReserved = Math.max(cartReserved - releaseQuantity, 0)

        return {
          ...currentVariation,
          cartReserved: nextVariationCartReserved,
        }
      },
      { applyLocally: false },
    )

    if (!variationRelease.committed) {
      throw new Error('Nao foi possivel liberar a reserva desta variacao.')
    }

    variationReleased = true

    const inventoryRelease = await runTransaction(
      ref(rtdb, `inventory/${productId}`),
      (currentValue) => {
        const currentInventory =
          currentValue && typeof currentValue === 'object' ? { ...(currentValue as Record<string, unknown>) } : {}
        const cartReserved = toNumber(currentInventory.cartReserved)
        const available = getInventoryAvailable(currentInventory)

        return {
          ...currentInventory,
          available,
          cartReserved: Math.max(cartReserved - releaseQuantity, 0),
        }
      },
      { applyLocally: false },
    )

    if (!inventoryRelease.committed) {
      throw new Error('Nao foi possivel liberar a reserva deste produto.')
    }

    inventoryReleased = true

    await persistCartReservationRecord({
      cartId,
      itemId,
      productId,
      variationKey,
      quantity: nextItemQuantity,
      nextVariationCartReserved,
      source: 'liberacao_carrinho',
    })
  } catch (error) {
    if (inventoryReleased) {
      await runTransaction(
        ref(rtdb, `inventory/${productId}`),
        (currentValue) => {
          const currentInventory =
            currentValue && typeof currentValue === 'object' ? { ...(currentValue as Record<string, unknown>) } : {}
          return {
            ...currentInventory,
            cartReserved: toNumber(currentInventory.cartReserved) + releaseQuantity,
          }
        },
        { applyLocally: false },
      )
    }

    if (variationReleased) {
      await runTransaction(
        ref(rtdb, `showcase/${productId}/variations/${variationKey}`),
        (currentValue) => {
          if (!currentValue || typeof currentValue !== 'object') {
            return currentValue
          }

          const currentVariation = { ...(currentValue as Record<string, unknown>) }
          return {
            ...currentVariation,
            cartReserved: toNumber(currentVariation.cartReserved) + releaseQuantity,
          }
        },
        { applyLocally: false },
      )
    }

    throw error
  }
}
