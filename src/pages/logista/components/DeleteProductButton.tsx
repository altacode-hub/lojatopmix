import { useState } from 'react'
import { get, ref, update } from 'firebase/database'
import { deleteObject, ref as storageRef } from 'firebase/storage'
import { FiTrash2 } from 'react-icons/fi'
import type { CatalogVariation, ProductPricing } from '../../../types/catalog'
import { rtdb, storage } from '../../../service/firebase'
import { CATALOG_SYNC_PATH, removeCachedStockProduct } from '../stockCache'
import { logistaTheme } from '../logistaTheme'

interface InventoryRecord {
  total?: number
  reserved?: number
  available?: number
  cartReserved?: number
}

export interface DeleteProductButtonProduct {
  id: string
  name: string
  image: string
  images: string[]
  pricing: ProductPricing
  variations: Record<string, CatalogVariation>
  inventory: InventoryRecord
  createdAt: number
}

interface DeleteProductButtonProps {
  purchaseId: string
  product: DeleteProductButtonProduct
  products: DeleteProductButtonProduct[]
  disabled?: boolean
  onDeleted: (remainingProducts: DeleteProductButtonProduct[], remainingTotalPieces: number) => void
}

const toNumber = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

const hasNumericValue = (value: unknown) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))

const getVariationStock = (variation: CatalogVariation) => toNumber(variation.stock)

const getTotalVariationStock = (variations: CatalogVariation[]) => variations.reduce((sum, variation) => sum + getVariationStock(variation), 0)

const getTotalStock = (inventory: InventoryRecord, variations: CatalogVariation[]) => {
  if (hasNumericValue(inventory.total)) {
    return Math.max(toNumber(inventory.total), 0)
  }

  return getTotalVariationStock(variations)
}

const normalizeImages = (...values: Array<string[] | string | undefined>) =>
  Array.from(
    new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
        .filter(Boolean),
    ),
  )

const isStorageObjectNotFound = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'storage/object-not-found'

type LinkedSaleRecord = {
  saleId: string
  fulfillmentStatus: string
  stockStatus: string
}

type StockMovementRecord = {
  productId?: string
  purchaseId?: string
  saleId?: string
  type?: string
  createdAt?: number
}

const getLinkedSales = (sales: Record<string, unknown>, productId: string) =>
  Object.entries(sales).flatMap(([saleId, sale]) => {
    if (!sale || typeof sale !== 'object') {
      return []
    }

    const items = Array.isArray((sale as { items?: unknown[] }).items) ? (sale as { items: unknown[] }).items : []
    const isLinked = items.some(
      (item) => item && typeof item === 'object' && (item as { productId?: string | null }).productId === productId,
    )

    if (!isLinked) {
      return []
    }

    return [
      {
        saleId,
        fulfillmentStatus: String((sale as { fulfillmentStatus?: string }).fulfillmentStatus || ''),
        stockStatus: String((sale as { stockStatus?: string }).stockStatus || ''),
      } satisfies LinkedSaleRecord,
    ]
  })

const hasActiveCartReservation = (cartReservations: Record<string, unknown>, productId: string) =>
  Object.values(cartReservations).some((reservation) => {
    if (!reservation || typeof reservation !== 'object') {
      return false
    }

    if ((reservation as { status?: string }).status !== 'active') {
      return false
    }

    const items = (reservation as { items?: Record<string, unknown> }).items || {}
    return Object.values(items).some(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as { productId?: string; quantity?: number }).productId === productId &&
        toNumber((item as { quantity?: number }).quantity) > 0,
    )
  })

const isCancelledSaleWithoutStockImpact = (sale: LinkedSaleRecord) =>
  sale.fulfillmentStatus === 'cancelled' && sale.stockStatus === 'released'

const isReversibleCancelledMovement = (
  movement: StockMovementRecord,
  linkedSalesById: Map<string, LinkedSaleRecord>,
) => {
  if (!movement.saleId) {
    return false
  }

  const linkedSale = linkedSalesById.get(movement.saleId)
  if (!linkedSale || !isCancelledSaleWithoutStockImpact(linkedSale)) {
    return false
  }

  return movement.type === 'reserve_counter_sale' || movement.type === 'cancel_reserved_sale'
}

const hasBlockingLaterStockMovement = (
  stockMovements: Record<string, unknown>,
  productId: string,
  createdAt: number,
  purchaseId: string,
  linkedSalesById: Map<string, LinkedSaleRecord>,
) =>
  Object.values(stockMovements).some((movement) => {
    if (!movement || typeof movement !== 'object') {
      return false
    }

    const currentMovement = movement as StockMovementRecord
    if (currentMovement.productId !== productId || toNumber(currentMovement.createdAt) <= createdAt) {
      return false
    }

    if (currentMovement.type === 'entry' && currentMovement.purchaseId === purchaseId) {
      return false
    }

    if (isReversibleCancelledMovement(currentMovement, linkedSalesById)) {
      return false
    }

    return true
  })

export default function DeleteProductButton({
  purchaseId,
  product,
  products,
  disabled = false,
  onDeleted,
}: DeleteProductButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!purchaseId || disabled || loading) return

    const confirmed = window.confirm(
      `Deseja excluir o produto "${product.name}"? Esta acao remove o produto do pedido, do estoque e apaga as imagens no storage.`,
    )

    if (!confirmed) return

    setLoading(true)

    try {
      const [salesSnap, cartReservationsSnap, stockMovementsSnap] = await Promise.all([
        get(ref(rtdb, 'sales')),
        get(ref(rtdb, 'cartReservations')),
        get(ref(rtdb, 'stockMovements')),
      ])

      const sales = (salesSnap.exists() ? salesSnap.val() : {}) as Record<string, unknown>
      const cartReservations = (cartReservationsSnap.exists() ? cartReservationsSnap.val() : {}) as Record<string, unknown>
      const stockMovements = (stockMovementsSnap.exists() ? stockMovementsSnap.val() : {}) as Record<string, unknown>

      const linkedSales = getLinkedSales(sales, product.id)
      const linkedSalesById = new Map(linkedSales.map((sale) => [sale.saleId, sale]))
      const hasActiveLinkedSale = linkedSales.some((sale) => !isCancelledSaleWithoutStockImpact(sale))
      const hasInventoryReservation = toNumber(product.inventory.reserved) > 0 || toNumber(product.inventory.cartReserved) > 0
      const activeCartReservationExists = hasActiveCartReservation(cartReservations, product.id)
      const laterStockMovementExists = hasBlockingLaterStockMovement(
        stockMovements,
        product.id,
        toNumber(product.createdAt),
        purchaseId,
        linkedSalesById,
      )

      const blockingReasons = [
        hasActiveLinkedSale ? 'Ja existe venda vinculada a este produto com impacto real de estoque.' : null,
        hasInventoryReservation ? 'O produto possui reserva registrada no estoque.' : null,
        activeCartReservationExists ? 'O produto possui reserva ativa em carrinho.' : null,
        laterStockMovementExists ? 'Existem movimentacoes de estoque posteriores ao cadastro do produto.' : null,
      ].filter(Boolean)

      if (blockingReasons.length > 0) {
        alert(`Nao e possivel excluir este produto:\n\n- ${blockingReasons.join('\n- ')}`)
        return
      }

      const imageUrls = normalizeImages(product.image, product.images)

      const now = Date.now()
      const remainingProducts = products.filter((item) => item.id !== product.id)
      const remainingTotalPieces = remainingProducts.reduce((sum, item) => {
        const variations = Object.values(item.variations || {})
        return sum + getTotalStock(item.inventory, variations)
      }, 0)

      const updates: Record<string, string | number | null> = {
        [`purchaseItems/${purchaseId}/${product.id}`]: null,
        [`products/${product.id}`]: null,
        [`showcase/${product.id}`]: null,
        [`inventory/${product.id}`]: null,
        [`purchases/${purchaseId}/totalPieces`]: remainingTotalPieces,
        [`purchases/${purchaseId}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/source`]: 'pedido_detalhes_delete_product',
      }

      await Promise.all(
        imageUrls.map(async (imageUrl) => {
          try {
            await deleteObject(storageRef(storage, imageUrl))
          } catch (error) {
            if (isStorageObjectNotFound(error)) return
            throw error
          }
        }),
      )

      Object.entries(stockMovements as Record<string, { productId?: string; purchaseId?: string; type?: string }>).forEach(([movementId, movement]) => {
        if (movement.productId === product.id && movement.purchaseId === purchaseId && movement.type === 'entry') {
          updates[`stockMovements/${movementId}`] = null
        }
      })

      await update(ref(rtdb), updates)
      removeCachedStockProduct(product.id, now)
      onDeleted(remainingProducts, remainingTotalPieces)
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('Nao foi possivel excluir o produto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDelete()}
      disabled={disabled || loading}
      aria-label="Excluir produto"
      title="Excluir produto"
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        border: `1px solid ${logistaTheme.colors.errorBorder}`,
        background: logistaTheme.colors.errorBackground,
        color: logistaTheme.colors.errorText,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: 14,
        opacity: disabled || loading ? 0.7 : 1,
      }}
    >
      <FiTrash2 />
      {loading ? 'Excluindo...' : 'Excluir'}
    </button>
  )
}
