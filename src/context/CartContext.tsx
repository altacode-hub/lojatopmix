import { onValue, ref } from 'firebase/database'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getOrCreateCartId, releaseCartItem, reserveCartItem } from '../utils/cartReservations'
import { useAuth } from './AuthContext'
import { rtdb } from '../service/firebase'

export type CartItem = {
  id: string
  productId: string
  variationKey: string
  name: string
  price: number
  qty: number
  note?: string
}

type CartContextType = {
  items: CartItem[]
  cartId: string
  add: (item: CartItem) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: (options?: { releaseReservations?: boolean }) => Promise<void>
  total: number
}

const CART_STORAGE_KEY = 'topmix_cart_items'

const readStoredCartItems = () => {
  if (typeof window === 'undefined') return []

  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!rawValue) return []
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? (parsed as CartItem[]) : []
  } catch {
    return []
  }
}

type CartReservationSnapshot = {
  status?: string
  items?: Record<
    string,
    {
      itemId?: string
      quantity?: number
    } | null
  >
} | null

const CartContext = createContext<CartContextType>({
  items: [],
  cartId: '',
  add: async () => {},
  remove: async () => {},
  clear: async () => {},
  total: 0,
})

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(readStoredCartItems)
  const [cartId] = useState(() => getOrCreateCartId())
  const { user, loading, signInAnonymously } = useAuth()

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    if (loading || !user) return

    const reservationRef = ref(rtdb, `cartReservations/${cartId}`)

    const unsubscribe = onValue(reservationRef, (snapshot) => {
      const reservation = (snapshot.exists() ? snapshot.val() : null) as CartReservationSnapshot

      setItems((currentItems) => {
        if (!reservation || reservation.status !== 'active') {
          return currentItems.length > 0 ? [] : currentItems
        }

        const backendItems = Object.entries(reservation.items || {}).reduce<Record<string, number>>((acc, [itemId, item]) => {
          const quantity = Number(item?.quantity || 0)
          if (quantity > 0) {
            acc[item?.itemId || itemId] = quantity
          }
          return acc
        }, {})

        const nextItems = currentItems
          .filter((item) => backendItems[item.id] > 0)
          .map((item) => {
            const backendQty = backendItems[item.id]
            return backendQty === item.qty ? item : { ...item, qty: backendQty }
          })

        if (
          nextItems.length === currentItems.length &&
          nextItems.every((item, index) => item.id === currentItems[index]?.id && item.qty === currentItems[index]?.qty)
        ) {
          return currentItems
        }

        return nextItems
      })
    })

    return () => unsubscribe()
  }, [cartId, loading, user])

  const ensureCartSession = useCallback(async () => {
    if (user) return
    if (loading) {
      throw new Error('Aguarde a autenticacao ser concluida e tente novamente.')
    }
    await signInAnonymously()
  }, [loading, signInAnonymously, user])

  const add = useCallback(
    async (item: CartItem) => {
      await ensureCartSession()
      await reserveCartItem({
        cartId,
        itemId: item.id,
        productId: item.productId,
        variationKey: item.variationKey,
        quantity: item.qty,
      })

      setItems((prev) => {
        const existing = prev.find((i) => i.id === item.id)
        if (existing) {
          return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + item.qty } : i))
        }
        return [...prev, item]
      })
    },
    [cartId, ensureCartSession],
  )

  const remove = useCallback(
    async (id: string) => {
      const item = items.find((entry) => entry.id === id)
      if (!item) return

      await ensureCartSession()
      await releaseCartItem({
        cartId,
        itemId: item.id,
        productId: item.productId,
        variationKey: item.variationKey,
        quantity: item.qty,
      })

      setItems((prev) => prev.filter((entry) => entry.id !== id))
    },
    [cartId, ensureCartSession, items],
  )

  const clear = useCallback(
    async (options?: { releaseReservations?: boolean }) => {
      const shouldReleaseReservations = options?.releaseReservations ?? true

      if (shouldReleaseReservations) {
        await ensureCartSession()
        for (const item of items) {
          await releaseCartItem({
            cartId,
            itemId: item.id,
            productId: item.productId,
            variationKey: item.variationKey,
            quantity: item.qty,
          })
        }
      }

      setItems([])
    },
    [cartId, ensureCartSession, items],
  )

  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items])

  const value = useMemo(() => ({ items, cartId, add, remove, clear, total }), [add, cartId, clear, items, remove, total])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext)
