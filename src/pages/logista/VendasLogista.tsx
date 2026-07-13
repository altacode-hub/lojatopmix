import { useCallback, useEffect, useMemo, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import type { CatalogVariation, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { variationLabel } from '../../utils/catalog'
import CounterSaleSection from './vendas/CounterSaleSection'
import PendingDeliveriesSection from './vendas/PendingDeliveriesSection'
import SalesHeader from './vendas/SalesHeader'
import SalesHistorySection from './vendas/SalesHistorySection'
import { getDateInputValue, getDateRange, hasVariationStock } from './vendas/helpers'
import type { CounterSaleItem, SaleItemRecord, SaleRecord, SaleableVariationRow } from './vendas/types'

export default function VendasLogista() {
  const { user } = useAuth()
  const [catalogRows, setCatalogRows] = useState<SaleableVariationRow[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [selectedItems, setSelectedItems] = useState<CounterSaleItem[]>([])
  const [search, setSearch] = useState('')
  const [periodStart, setPeriodStart] = useState(getDateInputValue(0))
  const [periodEnd, setPeriodEnd] = useState(getDateInputValue(0))
  const [loading, setLoading] = useState(true)
  const [savingCounterSale, setSavingCounterSale] = useState(false)
  const [deliveringSaleId, setDeliveringSaleId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [productsSnapshot, showcaseSnapshot, salesSnapshot] = await Promise.all([
        get(ref(rtdb, 'products')),
        get(ref(rtdb, 'showcase')),
        get(ref(rtdb, 'sales')),
      ])

      const productsData = (productsSnapshot.exists() ? productsSnapshot.val() : {}) as Record<string, InternalProductRecord>
      const showcaseData = (showcaseSnapshot.exists() ? showcaseSnapshot.val() : {}) as Record<string, ShowcaseRecord>
      const salesData = (salesSnapshot.exists() ? salesSnapshot.val() : {}) as Record<string, SaleRecord>

      const nextCatalogRows = Object.keys(productsData)
        .flatMap((productId) => {
          const product = productsData[productId]
          const showcase = showcaseData[productId]
          const variations = (showcase?.variations || product?.variations || {}) as Record<string, CatalogVariation>
          const unitPrice = Number(showcase?.price ?? product?.pricing?.salePrice ?? 0)

          return Object.entries(variations)
            .filter(([, variation]) => Number(variation?.stock || 0) > 0)
            .map(([variationKey, variation]) => ({
              id: `${productId}:${variationKey}`,
              productId,
              productName: showcase?.name || product?.name || productId,
              description: product?.description || showcase?.shortDescription || '',
              price: unitPrice,
              variationKey,
              variation,
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
            }))
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

      setCatalogRows(nextCatalogRows)
      setSales(nextSales)
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

  const finalizeCounterSale = async () => {
    if (!user) {
      setError('Usuario nao autenticado para registrar a venda.')
      return
    }

    if (selectedItems.length === 0) {
      setError('Selecione ao menos um item para finalizar a venda no balcao.')
      return
    }

    setSavingCounterSale(true)
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
        const inventory = inventorySnapshot.val() as { total?: number; available?: number; reserved?: number }

        const showcaseVariations = { ...(showcase.variations || {}) }
        const productVariations = { ...(product.variations || {}) }
        const showcaseVariation = showcaseVariations[item.variationKey]
        const productVariation = productVariations[item.variationKey] || showcaseVariation
        const currentVariationStock = Number(showcaseVariation?.stock ?? productVariation?.stock ?? 0)
        const currentAvailable = Number(inventory.available || 0)
        const currentTotal = Number(inventory.total || 0)

        if (!showcaseVariation) {
          throw new Error(`Variacao ${item.variationKey} nao encontrada para ${item.productName}.`)
        }

        if (item.qty > currentVariationStock || item.qty > currentAvailable || item.qty > currentTotal) {
          throw new Error(`Estoque insuficiente para ${item.productName} (${variationLabel(item.variation)}).`)
        }

        const nextVariationStock = currentVariationStock - item.qty
        const nextAvailable = currentAvailable - item.qty
        const nextTotal = currentTotal - item.qty

        showcaseVariations[item.variationKey] = {
          ...showcaseVariation,
          stock: nextVariationStock,
        }
        productVariations[item.variationKey] = {
          ...productVariation,
          stock: nextVariationStock,
        }

        updates[`inventory/${item.productId}`] = {
          total: nextTotal,
          reserved: Number(inventory.reserved || 0),
          available: nextAvailable,
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
            type: 'sale_counter',
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
        paymentStatus: 'paid',
        fulfillmentStatus: 'delivered',
        stockStatus: 'deducted',
        customer: null,
        items: saleItems,
        totalAmount: saleItems.reduce((sum, item) => sum + item.lineTotal, 0),
        totalItems: saleItems.reduce((sum, item) => sum + item.quantity, 0),
        notes: null,
        createdAt: now,
        paidAt: now,
        deliveredAt: now,
        updatedAt: now,
        sellerUid: user.uid,
      }

      await update(ref(rtdb), updates)
      setSelectedItems([])
      setSearch('')
      setSuccessMessage('Venda no balcao registrada com sucesso.')
      await loadData()
    } catch (saleError) {
      console.error('Erro ao finalizar venda no balcao:', saleError)
      setError(saleError instanceof Error ? saleError.message : 'Nao foi possivel finalizar a venda no balcao.')
    } finally {
      setSavingCounterSale(false)
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

        const inventory = inventorySnapshot.val() as { total?: number; available?: number; reserved?: number }
        const currentReserved = Number(inventory.reserved || 0)
        const currentTotal = Number(inventory.total || 0)

        if (currentReserved < item.quantity || currentTotal < item.quantity) {
          throw new Error(`A reserva do produto ${item.productName} nao cobre a entrega informada.`)
        }

        updates[`inventory/${item.productId}`] = {
          total: currentTotal - item.quantity,
          reserved: currentReserved - item.quantity,
          available: Number(inventory.available || 0),
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

      await update(ref(rtdb), updates)
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
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: 24, display: 'grid', gap: 24 }}>
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
        savingCounterSale={savingCounterSale}
        onSearchChange={setSearch}
        onAddItem={addSelectedItem}
        onUpdateSelectedQty={updateSelectedQty}
        onRemoveSelectedItem={removeSelectedItem}
        onFinalizeCounterSale={() => {
          void finalizeCounterSale()
        }}
      />

      <PendingDeliveriesSection
        pendingDeliveries={pendingDeliveries}
        deliveringSaleId={deliveringSaleId}
        onConfirmDelivery={(sale) => {
          void confirmOnlineDelivery(sale)
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
