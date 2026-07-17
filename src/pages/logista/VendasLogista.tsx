import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, onValue, push, ref, update } from 'firebase/database'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import type { CatalogVariation, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { getEffectiveVariationStock, variationLabel } from '../../utils/catalog'
import { releaseCartItem } from '../../utils/cartReservations'
import CounterSaleSection from './vendas/CounterSaleSection'
import PendingDeliveriesSection from './vendas/PendingDeliveriesSection'
import ReservedSalesSection from './vendas/ReservedSalesSection'
import SalesHeader from './vendas/SalesHeader'
import SalesHistorySection from './vendas/SalesHistorySection'
import { getDateInputValue, getDateRange, hasVariationStock } from './vendas/helpers'
import type { CounterSaleItem, ReservedSaleViewRecord, SaleItemRecord, SaleRecord, SaleableVariationRow } from './vendas/types'
import { CATALOG_SYNC_PATH, patchCachedStockProduct } from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'

export default function VendasLogista() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [catalogRows, setCatalogRows] = useState<SaleableVariationRow[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [cartReservedSales, setCartReservedSales] = useState<ReservedSaleViewRecord[]>([])
  const [selectedItems, setSelectedItems] = useState<CounterSaleItem[]>([])
  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState(getDateInputValue(0))
  const [periodEnd, setPeriodEnd] = useState(getDateInputValue(0))
  const [loading, setLoading] = useState(true)
  const [openingPayment, setOpeningPayment] = useState(false)
  const [reservingProducts, setReservingProducts] = useState(false)
  const [deliveringSaleId, setDeliveringSaleId] = useState<string | null>(null)
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastCatalogSyncRef = useRef(0)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [productsSnapshot, showcaseSnapshot, salesSnapshot, cartReservationsSnapshot] = await Promise.all([
        get(ref(rtdb, 'products')),
        get(ref(rtdb, 'showcase')),
        get(ref(rtdb, 'sales')),
        get(ref(rtdb, 'cartReservations')),
      ])

      const productsData = (productsSnapshot.exists() ? productsSnapshot.val() : {}) as Record<string, InternalProductRecord>
      const showcaseData = (showcaseSnapshot.exists() ? showcaseSnapshot.val() : {}) as Record<string, ShowcaseRecord>
      const salesData = (salesSnapshot.exists() ? salesSnapshot.val() : {}) as Record<string, SaleRecord>
      const cartReservationsData = (cartReservationsSnapshot.exists() ? cartReservationsSnapshot.val() : {}) as Record<
        string,
        {
          status?: string
          updatedAt?: number
          items?: Record<
            string,
            {
              itemId?: string
              productId?: string
              variationKey?: string
              quantity?: number
              updatedAt?: number
            } | null
          >
        }
      >

      const nextCatalogRows = Object.keys(productsData)
        .flatMap((productId) => {
          const product = productsData[productId]
          const showcase = showcaseData[productId]
          const variations = (showcase?.variations || product?.variations || {}) as Record<string, CatalogVariation>
          const unitPrice = Number(showcase?.price ?? product?.pricing?.salePrice ?? 0)

          return Object.entries(variations)
            .map(([variationKey, variation]) => {
              const effectiveStock = getEffectiveVariationStock(variation)

              return {
                id: `${productId}:${variationKey}`,
                productId,
                productName: showcase?.name || product?.name || productId,
                description: product?.description || showcase?.shortDescription || '',
                price: unitPrice,
                variationKey,
                variation: {
                  ...variation,
                  stock: effectiveStock,
                },
                searchText: [
                  productId,
                  showcase?.name,
                  product?.name,
                  product?.description,
                  variation.size,
                  variation.color,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase(),
              }
            })
            .filter((row) => row.variation.stock > 0)
        })
        .sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR'))

      const nextSales = Object.entries(salesData)
        .map(([saleId, sale]) => ({
          ...sale,
          saleId: sale.saleId || saleId,
          items: Array.isArray(sale.items) ? sale.items : [],
          totalAmount: Number(sale.totalAmount || 0),
          totalItems: Number(sale.totalItems || 0),
          createdAt: Number(sale.createdAt || 0),
        }))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))

      const nextCartReservedSales = Object.entries(cartReservationsData)
        .flatMap(([cartId, reservation]) => {
          if (!reservation || reservation.status !== 'active') {
            return []
          }

          const reservedItems = Object.entries(reservation.items || {})
            .flatMap(([itemId, item]) => {
              if (!item?.productId || !item.variationKey || !item.quantity) {
                return []
              }

              const product = productsData[item.productId]
              const showcase = showcaseData[item.productId]
              const showcaseVariation = showcase?.variations?.[item.variationKey]
              const productVariation = product?.variations?.[item.variationKey]
              const variation = showcaseVariation || productVariation
              const unitPrice = Number(showcase?.price ?? product?.pricing?.salePrice ?? 0)

              return [
                {
                  reservationItemId: item.itemId || itemId,
                  productId: item.productId,
                  variationKey: item.variationKey,
                  productName: showcase?.name || product?.name || item.productId,
                  description: product?.description || showcase?.shortDescription || '',
                  quantity: Number(item.quantity || 0),
                  unitPrice,
                  lineTotal: Number(item.quantity || 0) * unitPrice,
                  size: variation?.size || null,
                  color: variation?.color || null,
                  updatedAt: Number(item.updatedAt || reservation.updatedAt || 0),
                } satisfies SaleItemRecord & { updatedAt: number },
              ]
            })
            .filter((item) => item.quantity > 0)

          if (reservedItems.length === 0) {
            return []
          }

          const updatedAt = Math.max(
            Number(reservation.updatedAt || 0),
            ...reservedItems.map((item) => Number(item.updatedAt || 0)),
          )

          return [
            {
              saleId: `cart:${cartId}`,
              cartId,
              sourceType: 'cart',
              channel: 'carrinho',
              paymentStatus: 'pending',
              paymentMethod: null,
              fulfillmentStatus: 'reserved',
              stockStatus: 'reserved',
              totalAmount: reservedItems.reduce((sum, item) => sum + item.lineTotal, 0),
              totalItems: reservedItems.reduce((sum, item) => sum + item.quantity, 0),
              items: reservedItems.map(({ updatedAt: _updatedAt, ...item }) => item),
              customer: null,
              notes: 'Produtos reservados no carrinho do cliente.',
              createdAt: updatedAt,
              reservedAt: updatedAt,
              updatedAt,
            } satisfies ReservedSaleViewRecord,
          ]
        })
        .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))

      setCatalogRows(nextCatalogRows)
      setSales(nextSales)
      setCartReservedSales(nextCartReservedSales)
    } catch (loadError) {
      console.error('Erro ao carregar vendas do logista:', loadError)
      setError('Nao foi possivel carregar os dados de vendas e estoque.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const syncRef = ref(rtdb, `${CATALOG_SYNC_PATH}/updatedAt`)
    const unsubscribe = onValue(syncRef, (snapshot) => {
      const nextUpdatedAt = Number(snapshot.val() || 0)
      if (!nextUpdatedAt || nextUpdatedAt === lastCatalogSyncRef.current) {
        return
      }

      lastCatalogSyncRef.current = nextUpdatedAt
      void loadData()
    })

    return () => unsubscribe()
  }, [loadData])

  useEffect(() => {
    const navigationState = location.state as { successMessage?: string } | null

    if (!navigationState?.successMessage) {
      return
    }

    setSuccessMessage(navigationState.successMessage)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) {
      return catalogRows.slice(0, 24)
    }

    return catalogRows.filter((row) => row.searchText.includes(normalizedSearch)).slice(0, 24)
  }, [catalogRows, search])

  const selectedTotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.qty * item.price, 0),
    [selectedItems],
  )

  const periodStartTimestamp = useMemo(() => getDateRange(periodStart, false), [periodStart])
  const periodEndTimestamp = useMemo(() => getDateRange(periodEnd, true), [periodEnd])

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (sale.paymentStatus !== 'paid') return false
        if (periodStartTimestamp && sale.createdAt < periodStartTimestamp) return false
        if (periodEndTimestamp && sale.createdAt > periodEndTimestamp) return false
        return true
      }),
    [periodEndTimestamp, periodStartTimestamp, sales],
  )

  const pendingDeliveries = useMemo(
    () => sales.filter((sale) => sale.channel === 'online' && sale.fulfillmentStatus !== 'delivered'),
    [sales],
  )

  const reservedSales = useMemo(
    () =>
      [
        ...sales
          .filter(
            (sale) =>
              sale.stockStatus === 'reserved' ||
              (sale.channel === 'online' && sale.fulfillmentStatus !== 'delivered'),
          )
          .map((sale) => ({ ...sale, sourceType: 'sale' as const })),
        ...cartReservedSales,
      ].sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)),
    [cartReservedSales, sales],
  )

  const historyStats = useMemo(
    () => ({
      totalSales: filteredSales.length,
      totalRevenue: filteredSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0),
      totalItems: filteredSales.reduce((sum, sale) => sum + Number(sale.totalItems || 0), 0),
    }),
    [filteredSales],
  )

  const addSelectedItem = (row: SaleableVariationRow) => {
    setSuccessMessage(null)
    setError(null)
    setSelectedItems((current) => {
      const existing = current.find((item) => item.id === row.id)

      if (existing) {
        const nextQty = Math.min(existing.qty + 1, Number(row.variation.stock || 0))
        return current.map((item) => (item.id === row.id ? { ...item, qty: nextQty } : item))
      }

      return [...current, { ...row, qty: 1 }]
    })
  }

  const updateSelectedQty = (itemId: string, nextQty: number) => {
    setSelectedItems((current) =>
      current
        .map((item) => {
          if (item.id !== itemId) return item

          const maxQty = Math.max(1, Number(item.variation.stock || 0))
          return {
            ...item,
            qty: Math.max(1, Math.min(nextQty, maxQty)),
          }
        })
        .filter((item) => item.qty > 0),
    )
  }

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems((current) => current.filter((item) => item.id !== itemId))
  }

  const openPaymentForSelectedItems = () => {
    if (selectedItems.length === 0) {
      setError('Selecione ao menos um item para seguir para a forma de pagamento.')
      return
    }

    setError(null)
    setSuccessMessage(null)
    setOpeningPayment(true)

    navigate('/logista/vendas/pagamento', {
      state: { selectedItems },
    })
  }

  const reserveCounterSale = async () => {
    if (!user) {
      setError('Usuario nao autenticado para registrar a reserva.')
      return
    }

    if (selectedItems.length === 0) {
      setError('Selecione ao menos um item para reservar os produtos.')
      return
    }

    setReservingProducts(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const saleRef = push(ref(rtdb, 'sales'))
      const saleId = saleRef.key

      if (!saleId) {
        throw new Error('Nao foi possivel gerar o identificador da venda.')
      }

      const now = Date.now()
      const updates: Record<string, unknown> = {}
      const saleItems: SaleItemRecord[] = []

      for (const item of selectedItems) {
        const [productSnapshot, showcaseSnapshot, inventorySnapshot] = await Promise.all([
          get(ref(rtdb, `products/${item.productId}`)),
          get(ref(rtdb, `showcase/${item.productId}`)),
          get(ref(rtdb, `inventory/${item.productId}`)),
        ])

        if (!productSnapshot.exists() || !showcaseSnapshot.exists() || !inventorySnapshot.exists()) {
          throw new Error(`Produto ${item.productId} nao esta consistente no sistema.`)
        }

        const product = productSnapshot.val() as InternalProductRecord
        const showcase = showcaseSnapshot.val() as ShowcaseRecord
        const inventory = inventorySnapshot.val() as { total?: number; available?: number; reserved?: number; cartReserved?: number }

        const showcaseVariations = { ...(showcase.variations || {}) }
        const productVariations = { ...(product.variations || {}) }
        const showcaseVariation = showcaseVariations[item.variationKey]
        const productVariation = productVariations[item.variationKey] || showcaseVariation
        const currentVariationStock = Number(showcaseVariation?.stock ?? productVariation?.stock ?? 0)
        const currentVariationCartReserved = Number(showcaseVariation?.cartReserved ?? productVariation?.cartReserved ?? 0)
        const currentAvailable = Number(inventory.available || 0)
        const currentTotal = Number(inventory.total || 0)
        const currentCartReserved = Number(inventory.cartReserved || 0)

        if (!showcaseVariation) {
          throw new Error(`Variacao ${item.variationKey} nao encontrada para ${item.productName}.`)
        }

        const effectiveVariationStock = Math.max(currentVariationStock - currentVariationCartReserved, 0)
        const effectiveAvailable = Math.max(currentAvailable - currentCartReserved, 0)

        if (item.qty > effectiveVariationStock || item.qty > effectiveAvailable || item.qty > currentTotal) {
          throw new Error(`Estoque insuficiente para ${item.productName} (${variationLabel(item.variation)}).`)
        }

        const nextVariationStock = currentVariationStock - item.qty
        const nextAvailable = currentAvailable - item.qty
        const nextReserved = Number(inventory.reserved || 0) + item.qty

        showcaseVariations[item.variationKey] = {
          ...showcaseVariation,
          stock: nextVariationStock,
        }
        productVariations[item.variationKey] = {
          ...productVariation,
          stock: nextVariationStock,
        }

        updates[`inventory/${item.productId}`] = {
          total: currentTotal,
          reserved: nextReserved,
          available: nextAvailable,
          cartReserved: currentCartReserved,
        }
        updates[`showcase/${item.productId}/variations`] = showcaseVariations
        updates[`showcase/${item.productId}/stock`] = hasVariationStock(showcaseVariations)
        updates[`showcase/${item.productId}/updatedAt`] = now
        updates[`products/${item.productId}/variations`] = productVariations
        updates[`products/${item.productId}/updatedAt`] = now

        const movementKey = push(ref(rtdb, 'stockMovements')).key
        if (movementKey) {
          updates[`stockMovements/${movementKey}`] = {
            productId: item.productId,
            variation: item.variationKey,
            quantity: item.qty,
            type: 'reserve_counter_sale',
            saleId,
            createdAt: now,
          }
        }

        saleItems.push({
          productId: item.productId,
          variationKey: item.variationKey,
          productName: item.productName,
          description: item.description,
          quantity: item.qty,
          unitPrice: item.price,
          lineTotal: item.qty * item.price,
          size: item.variation.size,
          color: item.variation.color,
        })
      }

      updates[`sales/${saleId}`] = {
        saleId,
        channel: 'balcao',
        source: 'logista',
        paymentStatus: 'pending',
        paymentMethod: null,
        fulfillmentStatus: 'reserved',
        stockStatus: 'reserved',
        customer: null,
        items: saleItems,
        totalAmount: saleItems.reduce((sum, item) => sum + item.lineTotal, 0),
        totalItems: saleItems.reduce((sum, item) => sum + item.quantity, 0),
        notes: null,
        createdAt: now,
        reservedAt: now,
        updatedAt: now,
        sellerUid: user.uid,
      }

      updates[`${CATALOG_SYNC_PATH}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/source`] = 'reserva_balcao'

      await update(ref(rtdb), updates)
      selectedItems.forEach((item) => {
        const inventoryUpdate = updates[`inventory/${item.productId}`] as { total?: number; reserved?: number; available?: number; cartReserved?: number } | undefined
        if (!inventoryUpdate) return

        const cartReserved = Number(inventoryUpdate.cartReserved || 0)
        patchCachedStockProduct(
          item.productId,
          {
            totalStock: Number(inventoryUpdate.total || 0),
            reservedStock: Number(inventoryUpdate.reserved || 0) + cartReserved,
            availableStock: Math.max(Number(inventoryUpdate.available || 0) - cartReserved, 0),
            updatedAt: now,
          },
          now,
        )
      })
      setSelectedItems([])
      setSearch('')
      setSuccessMessage('Produtos reservados com sucesso.')
      await loadData()
    } catch (saleError) {
      console.error('Erro ao reservar venda no balcao:', saleError)
      setError(saleError instanceof Error ? saleError.message : 'Nao foi possivel reservar os produtos da venda.')
    } finally {
      setReservingProducts(false)
    }
  }

  const openPaymentForReservedSale = (sale: ReservedSaleViewRecord) => {
    setError(null)
    setSuccessMessage(null)

    if (sale.sourceType === 'cart') {
      setError('Reservas de carrinho nao possuem pagamento direto nesta tela.')
      return
    }

    navigate('/logista/vendas/pagamento', {
      state: { reservedSale: sale },
    })
  }

  const cancelReservedSale = async (sale: ReservedSaleViewRecord) => {
    if (sale.channel === 'online') {
      setError('Compras online aprovadas nao podem ser canceladas por esta secao.')
      return
    }

    setCancellingReservationId(sale.saleId)
    setError(null)
    setSuccessMessage(null)

    try {
      const now = Date.now()

      if (sale.sourceType === 'cart' && sale.cartId) {
        for (const item of sale.items || []) {
          if (!item.productId || !item.variationKey || !item.reservationItemId) {
            continue
          }

          await releaseCartItem({
            cartId: sale.cartId,
            itemId: item.reservationItemId,
            productId: item.productId,
            variationKey: item.variationKey,
            quantity: item.quantity,
          })
        }

        await update(ref(rtdb), {
          [`cartReservations/${sale.cartId}/status`]: 'cancelled',
          [`cartReservations/${sale.cartId}/updatedAt`]: now,
          [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
          [`${CATALOG_SYNC_PATH}/source`]: 'cancelamento_reserva_carrinho',
        })

        setSuccessMessage('Reserva do carrinho cancelada e estoque liberado com sucesso.')
        await loadData()
        return
      }

      const updates: Record<string, unknown> = {}

      for (const item of sale.items || []) {
        if (!item.productId || !item.variationKey) {
          continue
        }

        const [productSnapshot, showcaseSnapshot, inventorySnapshot] = await Promise.all([
          get(ref(rtdb, `products/${item.productId}`)),
          get(ref(rtdb, `showcase/${item.productId}`)),
          get(ref(rtdb, `inventory/${item.productId}`)),
        ])

        if (!productSnapshot.exists() || !showcaseSnapshot.exists() || !inventorySnapshot.exists()) {
          throw new Error(`Produto ${item.productId} nao esta consistente para cancelar a reserva.`)
        }

        const product = productSnapshot.val() as InternalProductRecord
        const showcase = showcaseSnapshot.val() as ShowcaseRecord
        const inventory = inventorySnapshot.val() as {
          total?: number
          available?: number
          reserved?: number
          cartReserved?: number
        }

        const showcaseVariations = { ...(showcase.variations || {}) }
        const productVariations = { ...(product.variations || {}) }
        const showcaseVariation = showcaseVariations[item.variationKey]
        const productVariation = productVariations[item.variationKey] || showcaseVariation
        const currentVariationStock = Number(showcaseVariation?.stock ?? productVariation?.stock ?? 0)
        const currentAvailable = Number(inventory.available || 0)
        const currentReserved = Number(inventory.reserved || 0)
        const currentTotal = Number(inventory.total || 0)
        const currentCartReserved = Number(inventory.cartReserved || 0)

        if (!showcaseVariation) {
          throw new Error(`Variacao ${item.variationKey} nao encontrada para ${item.productName}.`)
        }

        const nextVariationStock = currentVariationStock + item.quantity
        const nextReserved = Math.max(currentReserved - item.quantity, 0)
        const nextAvailable = currentAvailable + item.quantity

        showcaseVariations[item.variationKey] = {
          ...showcaseVariation,
          stock: nextVariationStock,
        }
        productVariations[item.variationKey] = {
          ...productVariation,
          stock: nextVariationStock,
        }

        updates[`inventory/${item.productId}`] = {
          total: currentTotal,
          reserved: nextReserved,
          available: nextAvailable,
          cartReserved: currentCartReserved,
        }
        updates[`showcase/${item.productId}/variations`] = showcaseVariations
        updates[`showcase/${item.productId}/stock`] = hasVariationStock(showcaseVariations)
        updates[`showcase/${item.productId}/updatedAt`] = now
        updates[`products/${item.productId}/variations`] = productVariations
        updates[`products/${item.productId}/updatedAt`] = now

        const movementKey = push(ref(rtdb, 'stockMovements')).key
        if (movementKey) {
          updates[`stockMovements/${movementKey}`] = {
            productId: item.productId,
            variation: item.variationKey,
            quantity: item.quantity,
            type: 'cancel_reserved_sale',
            saleId: sale.saleId,
            createdAt: now,
          }
        }
      }

      updates[`sales/${sale.saleId}/paymentStatus`] = 'cancelled'
      updates[`sales/${sale.saleId}/fulfillmentStatus`] = 'cancelled'
      updates[`sales/${sale.saleId}/stockStatus`] = 'released'
      updates[`sales/${sale.saleId}/updatedAt`] = now
      updates[`sales/${sale.saleId}/cancelledAt`] = now
      updates[`${CATALOG_SYNC_PATH}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/source`] = 'cancelamento_reserva_balcao'

      await update(ref(rtdb), updates)

      ;(sale.items || []).forEach((item) => {
        const inventoryUpdate = updates[`inventory/${item.productId}`] as
          | { total?: number; reserved?: number; available?: number; cartReserved?: number }
          | undefined
        if (!inventoryUpdate || !item.productId) return

        const cartReserved = Number(inventoryUpdate.cartReserved || 0)
        patchCachedStockProduct(
          item.productId,
          {
            totalStock: Number(inventoryUpdate.total || 0),
            reservedStock: Number(inventoryUpdate.reserved || 0) + cartReserved,
            availableStock: Math.max(Number(inventoryUpdate.available || 0) - cartReserved, 0),
            updatedAt: now,
          },
          now,
        )
      })

      setSuccessMessage('Reserva cancelada e estoque devolvido ao disponivel.')
      await loadData()
    } catch (cancelError) {
      console.error('Erro ao cancelar reserva:', cancelError)
      setError(cancelError instanceof Error ? cancelError.message : 'Nao foi possivel cancelar a reserva.')
    } finally {
      setCancellingReservationId(null)
    }
  }

  const confirmOnlineDelivery = async (sale: SaleRecord) => {
    if (!sale.saleId) return

    setDeliveringSaleId(sale.saleId)
    setError(null)
    setSuccessMessage(null)

    try {
      const now = Date.now()
      const updates: Record<string, unknown> = {}

      for (const item of sale.items || []) {
        if (!item.productId || !item.variationKey) {
          continue
        }

        const inventorySnapshot = await get(ref(rtdb, `inventory/${item.productId}`))

        if (!inventorySnapshot.exists()) {
          throw new Error(`Estoque nao encontrado para o produto ${item.productId}.`)
        }

        const inventory = inventorySnapshot.val() as { total?: number; available?: number; reserved?: number; cartReserved?: number }
        const currentReserved = Number(inventory.reserved || 0)
        const currentTotal = Number(inventory.total || 0)
        const currentCartReserved = Number(inventory.cartReserved || 0)

        if (currentReserved < item.quantity || currentTotal < item.quantity) {
          throw new Error(`A reserva do produto ${item.productName} nao cobre a entrega informada.`)
        }

        updates[`inventory/${item.productId}`] = {
          total: currentTotal - item.quantity,
          reserved: currentReserved - item.quantity,
          available: Number(inventory.available || 0),
          cartReserved: currentCartReserved,
        }

        const movementKey = push(ref(rtdb, 'stockMovements')).key
        if (movementKey) {
          updates[`stockMovements/${movementKey}`] = {
            productId: item.productId,
            variation: item.variationKey,
            quantity: item.quantity,
            type: 'deliver_online_sale',
            saleId: sale.saleId,
            orderNsu: sale.orderNsu || null,
            createdAt: now,
          }
        }
      }

      updates[`sales/${sale.saleId}/fulfillmentStatus`] = 'delivered'
      updates[`sales/${sale.saleId}/stockStatus`] = 'deducted'
      updates[`sales/${sale.saleId}/deliveredAt`] = now
      updates[`sales/${sale.saleId}/updatedAt`] = now

      if (sale.orderNsu) {
        updates[`checkoutOrders/${sale.orderNsu}/deliveryStatus`] = 'delivered'
        updates[`checkoutOrders/${sale.orderNsu}/stockStatus`] = 'deducted'
        updates[`checkoutOrders/${sale.orderNsu}/deliveredAt`] = now
        updates[`checkoutOrders/${sale.orderNsu}/updatedAt`] = now
      }

      updates[`${CATALOG_SYNC_PATH}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/source`] = 'entrega_online'

      await update(ref(rtdb), updates)
      ;(sale.items || []).forEach((item) => {
        const inventoryUpdate = updates[`inventory/${item.productId}`] as { total?: number; reserved?: number; available?: number; cartReserved?: number } | undefined
        if (!inventoryUpdate || !item.productId) return

        const cartReserved = Number(inventoryUpdate.cartReserved || 0)
        patchCachedStockProduct(
          item.productId,
          {
            totalStock: Number(inventoryUpdate.total || 0),
            reservedStock: Number(inventoryUpdate.reserved || 0) + cartReserved,
            availableStock: Math.max(Number(inventoryUpdate.available || 0) - cartReserved, 0),
            updatedAt: now,
          },
          now,
        )
      })
      setSuccessMessage('Entrega confirmada e estoque baixado no sistema.')
      await loadData()
    } catch (deliveryError) {
      console.error('Erro ao confirmar entrega:', deliveryError)
      setError(deliveryError instanceof Error ? deliveryError.message : 'Nao foi possivel confirmar a entrega.')
    } finally {
      setDeliveringSaleId(null)
    }
  }

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: isMobile ? 16 : 24, display: 'grid', gap: 24 }}>
      <SalesHeader pendingDeliveriesCount={pendingDeliveries.length} totalSalesInPeriod={historyStats.totalSales} />

      {error ? (
        <div
          style={{
            borderRadius: 14,
            border: '1px solid #fdba74',
            background: '#fff7ed',
            color: '#9a3412',
            padding: '14px 16px',
          }}
        >
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div
          style={{
            borderRadius: 14,
            border: '1px solid #86efac',
            background: '#f0fdf4',
            color: '#166534',
            padding: '14px 16px',
          }}
        >
          {successMessage}
        </div>
      ) : null}

      <CounterSaleSection
        loading={loading}
        search={search}
        filteredCatalog={filteredCatalog}
        selectedItems={selectedItems}
        selectedTotal={selectedTotal}
        openingPayment={openingPayment}
        reservingProducts={reservingProducts}
        onSearchChange={setSearch}
        onAddItem={addSelectedItem}
        onUpdateSelectedQty={updateSelectedQty}
        onRemoveSelectedItem={removeSelectedItem}
        onFinalizeCounterSale={openPaymentForSelectedItems}
        onReserveProducts={() => {
          void reserveCounterSale()
        }}
      />

      <PendingDeliveriesSection
        pendingDeliveries={pendingDeliveries}
        deliveringSaleId={deliveringSaleId}
        onConfirmDelivery={(sale) => {
          void confirmOnlineDelivery(sale)
        }}
      />

      <ReservedSalesSection
        reservedSales={reservedSales}
        onOpenPayment={openPaymentForReservedSale}
        cancellingReservationId={cancellingReservationId}
        onCancelReservation={(sale) => {
          void cancelReservedSale(sale)
        }}
      />

      <SalesHistorySection
        periodStart={periodStart}
        periodEnd={periodEnd}
        filteredSales={filteredSales}
        historyStats={historyStats}
        onPeriodStartChange={setPeriodStart}
        onPeriodEndChange={setPeriodEnd}
      />
    </div>
  )
}
