export interface CatalogVariation {
  size: string
  color: string
  stock: number
  cartReserved?: number
}

export interface ProductPricing {
  unitCost: number
  allocatedCosts: number
  finalUnitCost: number
  packaging: number
  gifts: number
  accessories: number
  sellerCommission: number
  taxes: number
  operational: number
  grossMargin: number
  cardFee: number
  salePrice: number
  finalPrice?: number
  promotionPrice?: number
  realMargin?: number
  realMarginPercentage?: number
}

export interface InternalProductRecord {
  name: string
  description: string
  supplierName?: string
  categoryId: string
  active: boolean
  createdAt: number
  updatedAt: number
  image?: string
  images?: string[]
  pricing: ProductPricing
  variations: Record<string, CatalogVariation>
}

export interface ShowcaseRecord {
  purchaseId?: string
  name: string
  image?: string
  images?: string[]
  price: number
  promotionPrice?: number
  categoryId: string
  shortDescription: string
  available: boolean
  stock: boolean
  variations: Record<string, CatalogVariation>
  featured: boolean
  promotion: boolean
  updatedAt: number
}
