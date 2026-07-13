import { createContext, useContext, useMemo, useState } from 'react'

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
  add: (item: CartItem) => void
  remove: (id: string) => void
  clear: () => void
  total: number
}

const CartContext = createContext<CartContextType>({
  items: [],
  add: () => {},
  remove: () => {},
  clear: () => {},
  total: 0,
})

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([])

  const add = (item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        return prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + item.qty } : i))
      }
      return [...prev, item]
    })
  }
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))
  const clear = () => setItems([])
  const total = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items])

  const value = useMemo(() => ({ items, add, remove, clear, total }), [items, total])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => useContext(CartContext)
