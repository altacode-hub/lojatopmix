export interface CatalogVariation {
  size: string
  color: string
  stock: number
  cartReserved?: number
}

export interface CatalogCategoryRecord {
  name: string
  image?: string
  thumbnailImage?: string
  thumbnailZoom?: number
  thumbnailOffsetX?: number
  thumbnailOffsetY?: number
  hidden?: boolean
  order?: number
  createdAt?: number
  updatedAt?: number
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
  promotionPrice?: number | null
  realMargin?: number
  realMarginPercentage?: number
}

export interface InternalProductRecord {
  name: string
  description: string
  supplierName?: string
  categoryId: string
  groupCode?: string | null
  purchaseId: string
  active: boolean
  createdAt: number
  updatedAt: number
  image?: string
  images?: string[]
  mainImageZoom?: number
  mainImageOffsetX?: number
  mainImageOffsetY?: number
  pricing: ProductPricing
  variations: Record<string, CatalogVariation>
}

export interface ShowcaseRecord {
  purchaseId?: string
  name: string
  groupCode?: string | null
  image?: string
  images?: string[]
  mainImageZoom?: number
  mainImageOffsetX?: number
  mainImageOffsetY?: number
  price: number
  promotionPrice?: number | null
  categoryId: string
  shortDescription: string
  available: boolean
  stock: boolean
  variations: Record<string, CatalogVariation>
  featured: boolean
  promotion: boolean
  updatedAt: number
}
