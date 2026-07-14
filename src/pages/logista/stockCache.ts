import type { CatalogVariation, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'

export interface InventoryRecord {
  total?: number
  reserved?: number
  available?: number
}

export interface InventoryProductRow {
  id: string
  name: string
  description: string
  supplierName: string
  categoryName: string
  image: string
  salePrice: number
  finalUnitCost: number
  totalStock: number
  availableStock: number
  reservedStock: number
  totalVariations: number
  variationKeywords: string[]
  active: boolean
  available: boolean
  featured: boolean
  updatedAt: number
  searchText: string
}

export interface StockCachePayload {
  version: number
  syncedAt: number
  remoteUpdatedAt: number
  rows: InventoryProductRow[]
}

const STOCK_CACHE_KEY = 'logista-stock-cache-v1'
const STOCK_CACHE_VERSION = 1

export const CATALOG_SYNC_PATH = 'indexes/catalogSync'

export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const buildSearchText = (row: Omit<InventoryProductRow, 'searchText'>) =>
  normalizeText(
    [
      row.id,
      row.name,
      row.description,
      row.supplierName,
      row.categoryName,
      ...row.variationKeywords,
    ]
      .filter(Boolean)
      .join(' '),
  )

const withSearchText = (row: Omit<InventoryProductRow, 'searchText'>) => ({
  ...row,
  searchText: buildSearchText(row),
}) satisfies InventoryProductRow

export const buildInventoryProductRow = (
  productId: string,
  product: InternalProductRecord,
  showcase: ShowcaseRecord | null | undefined,
  inventory: InventoryRecord | null | undefined,
  categories: Record<string, string>,
) => {
  const variations = (showcase?.variations || product.variations || {}) as Record<string, CatalogVariation>
  const variationKeywords = Object.values(variations).flatMap((variation) => [variation.size, variation.color].filter(Boolean))
  const categoryId = showcase?.categoryId || product.categoryId || ''
  const availableStock = Number(inventory?.available ?? 0)
  const totalStock = Number(inventory?.total ?? availableStock)
  const reservedStock = Number(inventory?.reserved ?? 0)

  const baseRow = {
    id: productId,
    name: showcase?.name || product.name || 'Produto sem nome',
    description: product.description || showcase?.shortDescription || '',
    supplierName: product.supplierName || 'Fornecedor nao informado',
    categoryName: categories[categoryId] || 'Sem categoria',
    image: showcase?.image || product.image || '',
    salePrice: Number(showcase?.price ?? product.pricing?.salePrice ?? 0),
    finalUnitCost: Number(product.pricing?.finalUnitCost ?? 0),
    totalStock,
    availableStock,
    reservedStock,
    totalVariations: Object.keys(variations).length,
    variationKeywords,
    active: Boolean(product.active ?? true),
    available: Boolean(showcase?.available ?? true),
    featured: Boolean(showcase?.featured),
    updatedAt: Math.max(Number(product.updatedAt || 0), Number(showcase?.updatedAt || 0)),
  } satisfies Omit<InventoryProductRow, 'searchText'>

  return withSearchText(baseRow)
}

export const buildInventoryRows = (
  products: Record<string, InternalProductRecord>,
  showcase: Record<string, ShowcaseRecord>,
  inventory: Record<string, InventoryRecord>,
  categories: Record<string, string>,
) =>
  Object.entries(products)
    .map(([productId, product]) => buildInventoryProductRow(productId, product, showcase[productId], inventory[productId], categories))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export const readStockCache = () => {
  if (typeof window === 'undefined') return null

  try {
    const rawCache = window.localStorage.getItem(STOCK_CACHE_KEY)
    if (!rawCache) return null

    const parsedCache = JSON.parse(rawCache) as Partial<StockCachePayload>
    if (parsedCache.version !== STOCK_CACHE_VERSION || !Array.isArray(parsedCache.rows)) {
      window.localStorage.removeItem(STOCK_CACHE_KEY)
      return null
    }

    return {
      version: STOCK_CACHE_VERSION,
      syncedAt: Number(parsedCache.syncedAt || 0),
      remoteUpdatedAt: Number(parsedCache.remoteUpdatedAt || 0),
      rows: parsedCache.rows,
    } satisfies StockCachePayload
  } catch (error) {
    console.error('Erro ao ler cache local do estoque:', error)
    window.localStorage.removeItem(STOCK_CACHE_KEY)
    return null
  }
}

export const writeStockCache = (payload: Omit<StockCachePayload, 'version'>) => {
  if (typeof window === 'undefined') return

  const cachePayload: StockCachePayload = {
    version: STOCK_CACHE_VERSION,
    ...payload,
  }

  window.localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(cachePayload))
}

export const upsertCachedStockProduct = (row: InventoryProductRow, remoteUpdatedAt: number) => {
  const currentCache = readStockCache()
  const rows = currentCache?.rows || []
  const rowIndex = rows.findIndex((item) => item.id === row.id)
  const nextRows = [...rows]

  if (rowIndex >= 0) {
    nextRows[rowIndex] = withSearchText(row)
  } else {
    nextRows.push(withSearchText(row))
  }

  nextRows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  writeStockCache({
    syncedAt: Date.now(),
    remoteUpdatedAt,
    rows: nextRows,
  })
}

export const patchCachedStockProduct = (
  productId: string,
  changes: Partial<Omit<InventoryProductRow, 'id' | 'searchText'>>,
  remoteUpdatedAt: number,
) => {
  const currentCache = readStockCache()
  if (!currentCache) return

  const rowIndex = currentCache.rows.findIndex((item) => item.id === productId)
  if (rowIndex < 0) return

  const currentRow = currentCache.rows[rowIndex]
  const mergedRow = {
    ...currentRow,
    ...changes,
    id: productId,
    updatedAt: Number(changes.updatedAt ?? currentRow.updatedAt),
  } satisfies Omit<InventoryProductRow, 'searchText'>

  const nextRows = [...currentCache.rows]
  nextRows[rowIndex] = withSearchText(mergedRow)
  nextRows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  writeStockCache({
    syncedAt: Date.now(),
    remoteUpdatedAt,
    rows: nextRows,
  })
}
