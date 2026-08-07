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
  image?: string | null
  mainImageZoom?: number | null
  mainImageOffsetX?: number | null
  mainImageOffsetY?: number | null
}

export type RegisteredCounterSaleItem = SaleableVariationRow & {
  itemType: 'registered'
  qty: number
}

export type AdHocCounterSaleItem = {
  itemType: 'ad_hoc'
  id: string
  productName: string
  description: string
  price: number
  qty: number
}

export type CounterSaleItem = RegisteredCounterSaleItem | AdHocCounterSaleItem

export const isRegisteredCounterSaleItem = (item: CounterSaleItem): item is RegisteredCounterSaleItem =>
  item.itemType === 'registered'

export const isAdHocCounterSaleItem = (item: CounterSaleItem): item is AdHocCounterSaleItem =>
  item.itemType === 'ad_hoc'

export type SaleItemRecord = {
  productId?: string | null
  variationKey?: string | null
  reservationItemId?: string | null
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
  paymentMethod?: string | null
  fulfillmentStatus?: 'delivered' | 'pending_delivery' | 'pending_review' | 'reserved' | 'cancelled' | string
  stockStatus?: 'deducted' | 'reserved' | 'attention' | 'released' | string
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
  reservedAt?: number
  deliveredAt?: number
  cancelledAt?: number
  updatedAt?: number
  sellerUid?: string
}

export type ReservedSaleViewRecord = SaleRecord & {
  sourceType?: 'sale' | 'cart'
  cartId?: string
}
