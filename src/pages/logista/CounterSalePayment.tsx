import { useMemo, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import { FiArrowLeft, FiCreditCard, FiDollarSign } from 'react-icons/fi'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import type { InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { variationLabel } from '../../utils/catalog'
import { CATALOG_SYNC_PATH, patchCachedStockProduct } from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaInputStyle, logistaTheme } from './logistaTheme'
import { cardStyle, formatCurrency, hasVariationStock } from './vendas/helpers'
import type { CounterSaleItem, SaleItemRecord, SaleRecord } from './vendas/types'

type PaymentLocationState = {
  selectedItems?: CounterSaleItem[]
  reservedSale?: SaleRecord
}

const paymentOptions = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartao de credito' },
  { value: 'cartao_debito', label: 'Cartao de debito' },
] as const

export default function CounterSalePayment() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locationState = (location.state as PaymentLocationState | null) ?? null
  const selectedItems = Array.isArray(locationState?.selectedItems) ? locationState.selectedItems : []
  const reservedSale = locationState?.reservedSale?.saleId ? locationState.reservedSale : null

  const [paymentMethod, setPaymentMethod] = useState<string>(reservedSale?.paymentMethod || 'pix')
  const [customerName, setCustomerName] = useState(reservedSale?.customer?.name || '')
  const [customerPhone, setCustomerPhone] = useState(reservedSale?.customer?.phone_number || '')
  const [notes, setNotes] = useState(reservedSale?.notes || '')

  const hasPaymentContext = selectedItems.length > 0 || Boolean(reservedSale)

  const totalAmount = useMemo(() => {
    if (reservedSale) {
      return Number(reservedSale.totalAmount || 0)
    }

    return selectedItems.reduce((sum, item) => sum + item.qty * item.price, 0)
  }, [reservedSale, selectedItems])

  const totalItems = useMemo(() => {
    if (reservedSale) {
      return Number(reservedSale.totalItems || 0)
    }

    return selectedItems.reduce((sum, item) => sum + item.qty, 0)
  }, [reservedSale, selectedItems])

  const buildCustomer = () => {
    const trimmedName = customerName.trim()
    const trimmedPhone = customerPhone.trim()

    if (!trimmedName && !trimmedPhone && !reservedSale?.customer) {
      return null
    }

    return {
      ...(reservedSale?.customer || {}),
      ...(trimmedName ? { name: trimmedName } : {}),
      ...(trimmedPhone ? { phone_number: trimmedPhone } : {}),
    }
  }

  const handleSubmitPayment = async () => {
    if (!user) {
      setError('Usuario nao autenticado para concluir a venda.')
      return
    }

    if (!hasPaymentContext) {
      setError('Nao ha itens selecionados para pagamento.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const now = Date.now()
      const updates: Record<string, unknown> = {}
      const inventoryPatches: Array<{ productId: string; total: number; reserved: number; available: number }> = []
      const customer = buildCustomer()
      const normalizedNotes = notes.trim() || null

      if (reservedSale) {
        for (const item of reservedSale.items || []) {
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
            throw new Error(`A reserva do produto ${item.productName} nao cobre a baixa final do estoque.`)
          }

          const nextInventory = {
            total: currentTotal - item.quantity,
            reserved: currentReserved - item.quantity,
            available: Number(inventory.available || 0),
          }

          updates[`inventory/${item.productId}`] = nextInventory
          inventoryPatches.push({ productId: item.productId, ...nextInventory })

          const movementKey = push(ref(rtdb, 'stockMovements')).key
          if (movementKey) {
            updates[`stockMovements/${movementKey}`] = {
              productId: item.productId,
              variation: item.variationKey,
              quantity: item.quantity,
              type: 'finalize_reserved_sale',
              saleId: reservedSale.saleId,
              createdAt: now,
            }
          }
        }

        updates[`sales/${reservedSale.saleId}/paymentStatus`] = 'paid'
        updates[`sales/${reservedSale.saleId}/paymentMethod`] = paymentMethod
        updates[`sales/${reservedSale.saleId}/fulfillmentStatus`] = 'delivered'
        updates[`sales/${reservedSale.saleId}/stockStatus`] = 'deducted'
        updates[`sales/${reservedSale.saleId}/customer`] = customer
        updates[`sales/${reservedSale.saleId}/notes`] = normalizedNotes
        updates[`sales/${reservedSale.saleId}/paidAt`] = now
        updates[`sales/${reservedSale.saleId}/deliveredAt`] = now
        updates[`sales/${reservedSale.saleId}/updatedAt`] = now
        updates[`sales/${reservedSale.saleId}/sellerUid`] = user.uid
      } else {
        const saleRef = push(ref(rtdb, 'sales'))
        const saleId = saleRef.key

        if (!saleId) {
          throw new Error('Nao foi possivel gerar o identificador da venda.')
        }

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
          const nextInventory = {
            total: currentTotal - item.qty,
            reserved: Number(inventory.reserved || 0),
            available: currentAvailable - item.qty,
          }

          showcaseVariations[item.variationKey] = {
            ...showcaseVariation,
            stock: nextVariationStock,
          }
          productVariations[item.variationKey] = {
            ...productVariation,
            stock: nextVariationStock,
          }

          updates[`inventory/${item.productId}`] = nextInventory
          updates[`showcase/${item.productId}/variations`] = showcaseVariations
          updates[`showcase/${item.productId}/stock`] = hasVariationStock(showcaseVariations)
          updates[`showcase/${item.productId}/updatedAt`] = now
          updates[`products/${item.productId}/variations`] = productVariations
          updates[`products/${item.productId}/updatedAt`] = now
          inventoryPatches.push({ productId: item.productId, ...nextInventory })

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
          paymentMethod,
          fulfillmentStatus: 'delivered',
          stockStatus: 'deducted',
          customer,
          items: saleItems,
          totalAmount: saleItems.reduce((sum, item) => sum + item.lineTotal, 0),
          totalItems: saleItems.reduce((sum, item) => sum + item.quantity, 0),
          notes: normalizedNotes,
          createdAt: now,
          paidAt: now,
          deliveredAt: now,
          updatedAt: now,
          sellerUid: user.uid,
        }
      }

      updates[`${CATALOG_SYNC_PATH}/updatedAt`] = now
      updates[`${CATALOG_SYNC_PATH}/source`] = reservedSale ? 'pagamento_reserva_balcao' : 'pagamento_venda_balcao'

      await update(ref(rtdb), updates)

      inventoryPatches.forEach((patch) => {
        patchCachedStockProduct(
          patch.productId,
          {
            totalStock: Number(patch.total || 0),
            reservedStock: Number(patch.reserved || 0),
            availableStock: Number(patch.available || 0),
            updatedAt: now,
          },
          now,
        )
      })

      navigate('/logista/vendas', {
        replace: true,
        state: {
          successMessage: reservedSale
            ? 'Pagamento registrado e venda reservada concluida com sucesso.'
            : 'Venda no balcao finalizada com sucesso.',
        },
      })
    } catch (paymentError) {
      console.error('Erro ao concluir pagamento da venda:', paymentError)
      setError(paymentError instanceof Error ? paymentError.message : 'Nao foi possivel concluir o pagamento da venda.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 24 }}>
      <section
        style={{
          ...cardStyle,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <FiCreditCard size={18} />
            <h1 style={{ margin: 0, fontSize: 28 }}>Forma de pagamento</h1>
          </div>
          <div style={{ color: logistaTheme.colors.textMuted }}>
            {reservedSale
              ? 'Conclua o pagamento para transformar a reserva em venda finalizada.'
              : 'Defina a forma de pagamento antes de concluir a venda no balcao.'}
          </div>
        </div>

        <button
          onClick={() => navigate('/logista/vendas')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderRadius: 12,
            border: `1px solid ${logistaTheme.colors.borderStrong}`,
            background: logistaTheme.colors.surface,
            color: logistaTheme.colors.text,
            cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <FiArrowLeft size={16} />
          Voltar para vendas
        </button>
      </section>

      {!hasPaymentContext ? (
        <section style={cardStyle}>
          <div style={{ color: logistaTheme.colors.textMuted }}>
            Nenhuma venda foi enviada para esta etapa. Volte para a tela de vendas e selecione os produtos novamente.
          </div>
        </section>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <section style={{ ...cardStyle, display: 'grid', gap: 16, flex: '1 1 520px', minWidth: 0, maxWidth: '380px' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Forma de pagamento</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  {paymentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Nome do cliente</span>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Opcional"
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Telefone do cliente</span>
                <input
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  placeholder="Opcional"
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Observacoes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Informacoes adicionais sobre a venda"
                  rows={4}
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </label>
            </div>

            {error ? (
              <div
                style={{
                  borderRadius: 14,
                  border: `1px solid ${logistaTheme.colors.warningBorder}`,
                  background: logistaTheme.colors.warningBackground,
                  color: logistaTheme.colors.warningText,
                  padding: '14px 16px',
                }}
              >
                {error}
              </div>
            ) : null}
          </section>

          <aside style={{ ...cardStyle, flex: '1 1 320px', width: '100%', maxWidth: 380, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <FiDollarSign size={18} />
              <h2 style={{ margin: 0, fontSize: 24 }}>Resumo da venda</h2>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {reservedSale
                ? reservedSale.items.map((item, index) => (
                    <div
                      key={`${reservedSale.saleId}-${index}`}
                      style={{
                        border: `1px solid ${logistaTheme.colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        display: 'grid',
                        gap: 8,
                        background: logistaTheme.colors.surface,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.productName}</div>
                      <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                        {item.size || '-'} {item.color ? `• ${item.color}` : ''}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span>{item.quantity} item(ns)</span>
                        <strong>{formatCurrency(item.lineTotal)}</strong>
                      </div>
                    </div>
                  ))
                : selectedItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        border: `1px solid ${logistaTheme.colors.border}`,
                        borderRadius: 14,
                        padding: 14,
                        display: 'grid',
                        gap: 8,
                        background: logistaTheme.colors.surface,
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.productName}</div>
                      <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>{variationLabel(item.variation)}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span>{item.qty} item(ns)</span>
                        <strong>{formatCurrency(item.qty * item.price)}</strong>
                      </div>
                    </div>
                  ))}
            </div>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${logistaTheme.colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: logistaTheme.colors.textMuted }}>
                <span>Itens</span>
                <strong>{totalItems}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, color: logistaTheme.colors.text, fontSize: 18 }}>
                <span>Total</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </div>

              <button
                onClick={() => {
                  void handleSubmitPayment()
                }}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: 'none',
                  background: logistaTheme.colors.accent,
                  color: logistaTheme.colors.surface,
                  fontWeight: 800,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Concluindo pagamento...' : reservedSale ? 'Concluir reserva e pagar' : 'Confirmar pagamento'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
