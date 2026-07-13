import type { CatalogVariation } from '../../../types/catalog'

export type SaleableVariationRow = {
  id: string
  productId: string
  productName: string
  description: string
  price: number
  variationKey: string
  variation: CatalogVariation
  searchText: string
}

export type CounterSaleItem = SaleableVariationRow & {
  qty: number
}

export type SaleItemRecord = {
  productId?: string | null
  variationKey?: string | null
  productName: string
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  size?: string | null
  color?: string | null
}

export type SaleRecord = {
  saleId: string
  orderNsu?: string
  channel: 'balcao' | 'online' | string
  paymentStatus?: string
  fulfillmentStatus?: 'delivered' | 'pending_delivery' | 'pending_review' | string
  stockStatus?: 'deducted' | 'reserved' | 'attention' | string
  totalAmount: number
  totalItems: number
  items: SaleItemRecord[]
  customer?: {
    name?: string
    email?: string
    phone_number?: string
  } | null
  address?: {
    cep?: string
    number?: string
    complement?: string
  } | null
  notes?: string | null
  alerts?: string[] | null
  createdAt: number
  paidAt?: number
  deliveredAt?: number
  updatedAt?: number
}
