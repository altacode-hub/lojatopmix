import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, onValue, push, ref, update } from 'firebase/database'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import type { InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { getEffectiveVariationStock, variationLabel } from '../../utils/catalog'
import { releaseCartItem } from '../../utils/cartReservations'
import CounterSaleSection from './vendas/CounterSaleSection'
import PendingDeliveriesSection from './vendas/PendingDeliveriesSection'
import ReservedSalesSection from './vendas/ReservedSalesSection'
import SalesHeader from './vendas/SalesHeader'
import SalesHistorySection from './vendas/SalesHistorySection'
import { formatCurrency, getDateInputValue, getDateRange, hasVariationStock } from './vendas/helpers'
import {
  isAdHocCounterSaleItem,
  isRegisteredCounterSaleItem,
} from './vendas/types'
import type {
  AdHocCounterSaleItem,
  CounterSaleItem,
  RegisteredCounterSaleItem,
  ReservedSaleViewRecord,
  SaleItemRecord,
  SaleRecord,
  SaleableVariationRow,
} from './vendas/types'
import {
  CATALOG_SYNC_PATH,
  buildCounterSaleCatalogRows,
  clearCounterSaleDraft,
  patchCachedStockProduct,
  readCounterSaleCatalogCache,
  readCounterSaleDraft,
  writeCounterSaleCatalogCache,
  writeCounterSaleDraft,
} from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaTheme } from './logistaTheme'

const MIN_SEARCH_LENGTH = 3

export default function VendasLogista() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [catalogRows, setCatalogRows] = useState<SaleableVariationRow[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [cartReservedSales, setCartReservedSales] = useState<ReservedSaleViewRecord[]>([])
  const [selectedItems, setSelectedItems] = useState<CounterSaleItem[]>(() => readCounterSaleDraft() ?? [])
  const [draftLoadedFromCache, setDraftLoadedFromCache] = useState<number>(() => {
    const cachedDraft = readCounterSaleDraft()
    return Array.isArray(cachedDraft) && cachedDraft.length > 0 ? Date.now() : 0
  })
  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState(getDateInputValue(0))
  const [periodEnd, setPeriodEnd] = useState(getDateInputValue(0))
  const [loading, setLoading] = useState(true)
  const [syncingCatalog, setSyncingCatalog] = useState(false)
  const [catalogSyncedAt, setCatalogSyncedAt] = useState<number>(0)
  const [catalogSource, setCatalogSource] = useState<'local' | 'remote'>('local')
  const [openingPayment, setOpeningPayment] = useState(false)
  const [reservingProducts, setReservingProducts] = useState(false)
  const [deliveringSaleId, setDeliveringSaleId] = useState<string | null>(null)
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastCatalogSyncRef = useRef(0)

  const setCatalogFromRows = (rows: SaleableVariationRow[], syncedAt: number, remoteUpdatedAt: number, source: 'local' | 'remote') => {
    setCatalogRows(rows)
    setCatalogSyncedAt(syncedAt)
    setCatalogSource(source)
    lastCatalogSyncRef.current = remoteUpdatedAt
  }

  const loadSalesAndReservations = useCallback(async () => {
    const [salesResult, cartReservationsResult] = await Promise.allSettled([
      get(ref(rtdb, 'sales')),
      get(ref(rtdb, 'cartReservations')),
    ])

    if (salesResult.status === 'rejected') {
      throw salesResult.reason
    }

    const [productsForReservationsResult, showcaseForReservationsResult] = await Promise.allSettled([
      get(ref(rtdb, 'products')),
      get(ref(rtdb, 'showcase')),
    ])

    const salesSnapshot = salesResult.value
    const salesData = (salesSnapshot.exists() ? salesSnapshot.val() : {}) as Record<string, SaleRecord>
    const cartReservationsData =
      cartReservationsResult.status === 'fulfilled'
        ? ((cartReservationsResult.value.exists() ? cartReservationsResult.value.val() : {}) as Record<
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
          >)
        : {}

    const productsForReservations =
      productsForReservationsResult.status === 'fulfilled' && productsForReservationsResult.value.exists()
        ? (productsForReservationsResult.value.val() as Record<string, InternalProductRecord>)
        : {}
    const showcaseForReservations =
      showcaseForReservationsResult.status === 'fulfilled' && showcaseForReservationsResult.value.exists()
        ? (showcaseForReservationsResult.value.val() as Record<string, ShowcaseRecord>)
        : {}

    if (cartReservationsResult.status === 'rejected') {
      console.warn(
        'Nao foi possivel ler as reservas de carrinho para a tela de vendas:',
        (cartReservationsResult as PromiseRejectedResult).reason,
      )
      setWarningMessage(
        'As reservas de carrinho nao puderam ser carregadas no momento, mas as demais vendas foram exibidas normalmente.',
      )
    } else if (productsForReservationsResult.status === 'rejected' || showcaseForReservationsResult.status === 'rejected') {
      console.warn('Dados de produto/shop em falta para detalhar reservas de carrinho.')
    }

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

            const product = productsForReservations[item.productId]
            const showcase = showcaseForReservations[item.productId]
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

    setSales(nextSales)
    setCartReservedSales(nextCartReservedSales)
  }, [])

  const loadCounterSaleCatalogFromRemote = useCallback(async () => {
    const [productsResult, showcaseResult, syncResult] = await Promise.allSettled([
      get(ref(rtdb, 'products')),
      get(ref(rtdb, 'showcase')),
      get(ref(rtdb, `${CATALOG_SYNC_PATH}/updatedAt`)),
    ])

    if (productsResult.status === 'rejected') {
      throw (productsResult as PromiseRejectedResult).reason
    }

    if (showcaseResult.status === 'rejected') {
      throw (showcaseResult as PromiseRejectedResult).reason
    }

    const remoteUpdatedAt = syncResult.status === 'fulfilled' ? Number(syncResult.value.val() || 0) : 0
    const productsData = productsResult.value.exists()
      ? (productsResult.value.val() as Record<string, InternalProductRecord>)
      : {}
    const showcaseData = showcaseResult.value.exists()
      ? (showcaseResult.value.val() as Record<string, ShowcaseRecord>)
      : {}

    const nextCatalogRows = buildCounterSaleCatalogRows(productsData, showcaseData, getEffectiveVariationStock)
    const syncedAt = Date.now()

    writeCounterSaleCatalogCache({
      syncedAt,
      remoteUpdatedAt,
      rows: nextCatalogRows,
    })

    return {
      rows: nextCatalogRows,
      syncedAt,
      remoteUpdatedAt,
    }
  }, [])

  const loadCounterSaleCatalog = useCallback(async (forceRemote = false) => {
    const localCache = !forceRemote ? readCounterSaleCatalogCache() : null
    if (localCache && localCache.rows.length > 0) {
      setCatalogFromRows(localCache.rows, localCache.syncedAt, localCache.remoteUpdatedAt, 'local')
      return
    }

    try {
      const remotePayload = await loadCounterSaleCatalogFromRemote()
      setCatalogFromRows(remotePayload.rows, remotePayload.syncedAt, remotePayload.remoteUpdatedAt, 'remote')
    } catch (remoteError) {
      console.error('Erro ao carregar catalogo remoto da venda no balcao:', remoteError)
      if (localCache) {
        setCatalogFromRows(localCache.rows, localCache.syncedAt, localCache.remoteUpdatedAt, 'local')
        setWarningMessage(
          'A sincronizacao remota falhou. O catalogo de venda no balcao foi restaurado a partir do cache local.',
        )
      } else {
        throw remoteError
      }
    }
  }, [loadCounterSaleCatalogFromRemote])

  useEffect(() => {
    writeCounterSaleDraft(selectedItems)
  }, [selectedItems])

  const clearDraft = useCallback(() => {
    setSelectedItems([])
    setDraftLoadedFromCache(0)
    clearCounterSaleDraft()
  }, [])

  const loadData = useCallback(
    async (options?: { forceRemote?: boolean }) => {
      const forceRemote = Boolean(options?.forceRemote)
      try {
        setLoading(true)
        setError(null)
        setWarningMessage(null)

        await Promise.all([loadCounterSaleCatalog(forceRemote), loadSalesAndReservations()])
      } catch (loadError) {
        console.error('Erro ao carregar vendas do logista:', loadError)
        setError('Nao foi possivel carregar os dados de vendas e estoque.')
      } finally {
        setLoading(false)
      }
    },
    [loadCounterSaleCatalog, loadSalesAndReservations],
  )

  const handleSyncCatalog = useCallback(async () => {
    try {
      setSyncingCatalog(true)
      setError(null)
      setWarningMessage(null)

      const remotePayload = await loadCounterSaleCatalogFromRemote()
      setCatalogFromRows(remotePayload.rows, remotePayload.syncedAt, remotePayload.remoteUpdatedAt, 'remote')
      setSuccessMessage('Catalogo sincronizado com o banco de dados online.')
    } catch (syncError) {
      console.error('Erro ao sincronizar catalogo:', syncError)
      setError(syncError instanceof Error ? syncError.message : 'Nao foi possivel sincronizar o catalogo com o banco online.')
    } finally {
      setSyncingCatalog(false)
    }
  }, [loadCounterSaleCatalogFromRemote])

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
      void loadCounterSaleCatalog(true)
      void loadSalesAndReservations()
    })

    return () => unsubscribe()
  }, [loadCounterSaleCatalog, loadSalesAndReservations])

  useEffect(() => {
    const navigationState = location.state as { successMessage?: string; clearCounterSaleDraft?: boolean } | null

    if (navigationState?.clearCounterSaleDraft) {
      clearDraft()
    }

    if (!navigationState?.successMessage) {
      if (navigationState?.clearCounterSaleDraft) {
        navigate(location.pathname, { replace: true, state: null })
      }
      return
    }

    setSuccessMessage(navigationState.successMessage)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate, clearDraft])

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim()

    if (normalizedSearch.length < MIN_SEARCH_LENGTH) {
      return []
    }

    const searchTokens = normalizedSearch
      .split(/\s+/)
      .map((token) => token.toLowerCase())
      .filter(Boolean)

    return catalogRows
      .filter((row) =>
        searchTokens.every((token) => row.searchText.includes(token)),
      )
      .slice(0, 24)
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

      if (existing && isRegisteredCounterSaleItem(existing)) {
        const nextQty = Math.min(existing.qty + 1, Number(row.variation.stock || 0))
        return current.map((item) => (item.id === row.id ? { ...item, qty: nextQty } : item))
      }

      const nextItem: RegisteredCounterSaleItem = {
        ...row,
        itemType: 'registered',
        qty: 1,
      }

      return [...current, nextItem]
    })
  }

  const addAdHocItem = () => {
    setSuccessMessage(null)
    setError(null)
    setSelectedItems((current) => {
      const nextItem: AdHocCounterSaleItem = {
        itemType: 'ad_hoc',
        id: `ad_hoc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productName: '',
        description: '',
        price: 0,
        qty: 1,
      }

      return [...current, nextItem]
    })
  }

  const updateSelectedQty = (itemId: string, nextQty: number) => {
    setSelectedItems((current) =>
      current
        .map((item) => {
          if (item.id !== itemId) return item

          const sanitizedQty = Number.isFinite(nextQty) && nextQty > 0 ? nextQty : 1

          if (isRegisteredCounterSaleItem(item)) {
            const maxQty = Math.max(1, Number(item.variation.stock || 0))
            return {
              ...item,
              qty: Math.max(1, Math.min(sanitizedQty, maxQty)),
            }
          }

          return {
            ...item,
            qty: sanitizedQty,
          }
        })
        .filter((item) => item.qty > 0),
    )
  }

  const updateAdHocField = (
    itemId: string,
    field: 'productName' | 'price',
    rawValue: string,
  ) => {
    setSelectedItems((current) =>
      current.map((item) => {
        if (item.id !== itemId || !isAdHocCounterSaleItem(item)) return item

        if (field === 'productName') {
          return {
            ...item,
            productName: rawValue,
          }
        }

        const digits = rawValue.replace(/[^0-9]/g, '')
        const priceCents = digits ? Number(digits) : 0
        return {
          ...item,
          price: priceCents / 100,
        }
      }),
    )
  }

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems((current) => current.filter((item) => item.id !== itemId))
  }

  const getSelectedItemLineTotal = (item: CounterSaleItem) => {
    const price = Number.isFinite(item.price) ? item.price : 0
    const qty = Number.isFinite(item.qty) ? item.qty : 0
    return price * qty
  }

  const openPaymentForSelectedItems = () => {
    if (selectedItems.length === 0) {
      setError('Selecione ao menos um item para seguir para a forma de pagamento.')
      return
    }

    const invalidAdHoc = selectedItems.find((item) => {
      if (!isAdHocCounterSaleItem(item)) return false
      return !item.productName.trim() || item.price <= 0 || item.qty <= 0
    })

    if (invalidAdHoc && isAdHocCounterSaleItem(invalidAdHoc)) {
      setError('Preencha o nome do produto, a quantidade e o valor unitario para os itens avulsos antes de prosseguir.')
      setOpeningPayment(false)
      return
    }

    setError(null)
    setSuccessMessage(null)
    setOpeningPayment(true)

    navigate('/vendas/pagamento', {
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

    const invalidAdHoc = selectedItems.find((item) => {
      if (!isAdHocCounterSaleItem(item)) return false
      return !item.productName.trim() || item.price <= 0 || item.qty <= 0
    })

    if (invalidAdHoc && isAdHocCounterSaleItem(invalidAdHoc)) {
      setReservingProducts(false)
      setError('Preencha o nome do produto, a quantidade e o valor unitario dos itens avulsos antes de reservar.')
      return
    }

    try {
      const saleRef = push(ref(rtdb, 'sales'))
      const saleId = saleRef.key

      if (!saleId) {
        throw new Error('Nao foi possivel gerar o identificador da venda.')
      }

      const now = Date.now()
      const updates: Record<string, unknown> = {}
      const saleItems: SaleItemRecord[] = []
      const reservedRegisteredProductIds = new Set<string>()

      for (const item of selectedItems) {
        if (isAdHocCounterSaleItem(item)) {
          saleItems.push({
            productId: null,
            variationKey: null,
            productName: item.productName.trim(),
            description: 'Item avulso da venda no balcao.',
            quantity: item.qty,
            unitPrice: item.price,
            lineTotal: item.qty * item.price,
            size: null,
            color: null,
          })
          continue
        }

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
        reservedRegisteredProductIds.add(item.productId)

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

      clearCounterSaleDraft()
      setDraftLoadedFromCache(0)
      await update(ref(rtdb), updates)
      reservedRegisteredProductIds.forEach((productId) => {
        const inventoryUpdate = updates[`inventory/${productId}`] as
          | { total?: number; reserved?: number; available?: number; cartReserved?: number }
          | undefined
        if (!inventoryUpdate) return

        const cartReserved = Number(inventoryUpdate.cartReserved || 0)
        patchCachedStockProduct(
          productId,
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

    navigate('/vendas/pagamento', {
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

      <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);}}`}</style>

      {error ? (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${logistaTheme.colors.errorBorder}`,
            background: logistaTheme.colors.errorBackground,
            color: logistaTheme.colors.errorText,
            padding: '14px 16px',
          }}
        >
          {error}
        </div>
      ) : null}

      {warningMessage ? (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${logistaTheme.colors.warningBorder}`,
            background: logistaTheme.colors.warningBackground,
            color: logistaTheme.colors.warningText,
            padding: '14px 16px',
          }}
        >
          {warningMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div
          style={{
            borderRadius: 14,
            border: `1px solid ${logistaTheme.colors.successBorder}`,
            background: logistaTheme.colors.successBackground,
            color: logistaTheme.colors.successText,
            padding: '14px 16px',
          }}
        >
          {successMessage}
        </div>
      ) : null}

      <CounterSaleSection
        loading={loading}
        syncingCatalog={syncingCatalog}
        search={search}
        minSearchLength={MIN_SEARCH_LENGTH}
        catalogCount={catalogRows.length}
        catalogSource={catalogSource}
        catalogSyncedAt={catalogSyncedAt}
        filteredCatalog={filteredCatalog}
        selectedItems={selectedItems}
        selectedTotal={selectedTotal}
        draftLoadedFromCache={Boolean(draftLoadedFromCache && selectedItems.length > 0)}
        openingPayment={openingPayment}
        reservingProducts={reservingProducts}
        onSearchChange={setSearch}
        onAddItem={addSelectedItem}
        onAddAdHocItem={addAdHocItem}
        onUpdateSelectedQty={updateSelectedQty}
        onUpdateAdHocField={updateAdHocField}
        onRemoveSelectedItem={removeSelectedItem}
        onClearAllSelectedItems={clearDraft}
        onFinalizeCounterSale={openPaymentForSelectedItems}
        onReserveProducts={() => {
          void reserveCounterSale()
        }}
        onSyncCatalog={() => {
          void handleSyncCatalog()
        }}
        formatCurrency={formatCurrency}
        getSelectedItemLineTotal={getSelectedItemLineTotal}
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
