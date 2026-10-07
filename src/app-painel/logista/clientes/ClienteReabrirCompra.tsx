import { useCallback, useEffect, useMemo, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import { FiEdit2, FiRefreshCw, FiXSquare, FiSave } from 'react-icons/fi'
import { rtdb } from '../../../service/firebase'

import { logistaInputStyle, logistaTheme } from '../logistaTheme'

import { cardStyle, formatCurrency, formatDateTime } from '../vendas/helpers'
import type { SaleItemRecord, SaleRecord, CustomerRecord } from '../vendas/types'

type AuthUserRef = { uid: string; phoneNumber: string | null } | null

type ClienteReabrirCompraProps = {
  open: boolean
  sale: SaleRecord | null
  user: AuthUserRef
  isMobile: boolean
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

type EditItem = SaleItemRecord & {
  _priceText: string
}

const editDiscountCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const editPercentFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const parseNumericText = (value: string) => {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '')
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseCurrencyCents = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) return 0
  return Number(digitsOnly) / 100
}

const getDiscountCurrencyDisplayValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  return editDiscountCurrencyFormatter.format(value)
}

const getPercentDisplayValue = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  return editPercentFormatter.format(value)
}

const priceDisplay = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  return editDiscountCurrencyFormatter.format(value)
}

export default function ClienteReabrirCompra({
  open,
  sale,
  user,
  isMobile,
  onClose,
  onSaved,
  onError,
  onSuccess,
}: ClienteReabrirCompraProps) {
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [discountValueText, setDiscountValueText] = useState<string>('')
  const [discountPercentText, setDiscountPercentText] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [editingUserName, setEditingUserName] = useState<string>('')

  useEffect(() => {
    if (!sale) return
    const prefilled: EditItem[] = (sale.items || []).map((it) => ({
      ...it,
      _priceText: priceDisplay(Number(it.unitPrice || 0)),
    }))
    setEditItems(prefilled)
    setPaymentMethod(sale.paymentMethod || 'dinheiro')
    setNotes(sale.notes || '')
    const existingDiscValue = Number(sale.discountValue || 0)
    const existingDiscPercent = Number(sale.discountPercent || 0)
    setDiscountValueText(getDiscountCurrencyDisplayValue(existingDiscValue))
    setDiscountPercentText(getPercentDisplayValue(existingDiscPercent))
  }, [sale])

  useEffect(() => {
    if (!open || !user) return
    void (async () => {
      try {
        const snap = await get(ref(rtdb, `loja/lojistas/${user.uid}/name`))
        if (snap.exists() && typeof snap.val() === 'string') {
          setEditingUserName(snap.val())
          return
        }
      } catch {
        // ignore
      }
      setEditingUserName(user.uid)
    })()
  }, [open, user])

  const updateEditItemText = (index: number, rawText: string) => {
    setEditItems((prev) => {
      const next = [...prev]
      const current = next[index]
      if (!current) return prev
      next[index] = { ...current, _priceText: rawText }
      return next
    })
  }

  const updateEditItemQty = (index: number, rawQty: string) => {
    setEditItems((prev) => {
      const next = [...prev]
      const current = next[index]
      if (!current) return prev
      const qty = Math.max(0, Math.floor(Number(rawQty) || 0))
      const newUnit = parseCurrencyCents(current._priceText) || Number(current.unitPrice || 0)
      next[index] = {
        ...current,
        quantity: qty,
        unitPrice: newUnit,
        lineTotal: qty * newUnit,
      }
      return next
    })
  }

  useEffect(() => {
    setEditItems((prev) =>
      prev.map((it) => {
        const parsedUnit = parseCurrencyCents(it._priceText) || Number(it.unitPrice || 0)
        const newLine = Number(it.quantity || 0) * parsedUnit
        if (parsedUnit === Number(it.unitPrice || 0) && newLine === Number(it.lineTotal || 0)) return it
        return { ...it, unitPrice: parsedUnit, lineTotal: newLine }
      }),
    )
  }, [])

  const computeEditTotals = useCallback(() => {
    const subtotalItems = editItems.reduce((sum, it) => {
      const unit = parseCurrencyCents(it._priceText) || Number(it.unitPrice || 0)
      const qty = Number(it.quantity || 0)
      return sum + qty * unit
    }, 0)

    const rawDiscountValue = parseCurrencyCents(discountValueText)
    const rawDiscountPercent = parseNumericText(discountPercentText)
    const safeTotal = Math.max(0, subtotalItems)
    const clampedValue = Math.max(0, Math.min(rawDiscountValue, safeTotal))
    const clampedPercent = Math.max(0, Math.min(rawDiscountPercent, 100))

    let finalDiscountValue = 0
    if (discountValueText && !discountPercentText) {
      finalDiscountValue = clampedValue
    } else if (discountPercentText && !discountValueText) {
      const rawVal = (clampedPercent / 100) * safeTotal
      const roundedFinal = Math.round(safeTotal - rawVal)
      if (roundedFinal >= 0 && roundedFinal <= safeTotal) {
        finalDiscountValue = safeTotal - roundedFinal
      } else {
        finalDiscountValue = rawVal
      }
    } else if (discountValueText && discountPercentText) {
      finalDiscountValue = clampedValue
    }

    const finalDiscountPercent = safeTotal > 0 ? (finalDiscountValue / safeTotal) * 100 : 0
    const totalAmount = Math.max(0, subtotalItems - finalDiscountValue)
    const totalItems = editItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0)

    return {
      subtotalItems,
      finalDiscountValue,
      finalDiscountPercent,
      totalAmount,
      totalItems,
      discountApplied: finalDiscountValue > 0,
    }
  }, [editItems, discountValueText, discountPercentText])

  const editTotals = useMemo(() => computeEditTotals(), [computeEditTotals])

  useEffect(() => {
    if (!sale) return
    void computeEditTotals()
  }, [sale, computeEditTotals])

  const handleEditDiscountValueChange = (rawValue: string) => {
    if (!rawValue) {
      setDiscountValueText('')
      setDiscountPercentText('')
      return
    }
    const numeric = parseCurrencyCents(rawValue)
    const safeTotal = Math.max(0, editTotals.subtotalItems)
    const clamped = Math.max(0, Math.min(numeric, safeTotal))
    setDiscountValueText(getDiscountCurrencyDisplayValue(clamped))
    if (safeTotal <= 0) {
      setDiscountPercentText('')
      return
    }
    const percent = safeTotal > 0 ? (clamped / safeTotal) * 100 : 0
    setDiscountPercentText(getPercentDisplayValue(percent))
  }

  const handleEditDiscountPercentChange = (rawValue: string) => {
    setDiscountPercentText(rawValue)
    if (!rawValue) {
      setDiscountValueText('')
      return
    }
    const nextPercent = parseNumericText(rawValue)
    const clamped = Math.max(0, Math.min(nextPercent, 100))
    const safeTotal = Math.max(0, editTotals.subtotalItems)
    if (safeTotal <= 0) {
      setDiscountValueText('')
      return
    }
    const rawDiscount = (clamped / 100) * safeTotal
    const exactFinal = safeTotal - rawDiscount
    const roundedFinal = Math.round(exactFinal)
    let finalD = rawDiscount
    if (roundedFinal >= 0 && roundedFinal <= safeTotal) {
      const candidate = safeTotal - roundedFinal
      if (candidate >= 0 && candidate <= safeTotal) finalD = candidate
    }
    setDiscountValueText(getDiscountCurrencyDisplayValue(finalD))
  }

  const handleSave = async () => {
    if (!sale || !user) {
      onError('Venda ou usuário não identificados para reabrir a compra.')
      return
    }
    if (editItems.length === 0) {
      onError('A venda precisa ter ao menos um item.')
      return
    }
    if (editTotals.totalAmount <= 0) {
      onError('O valor total final da venda deve ser maior que zero.')
      return
    }

    setSaving(true)
    try {
      const now = Date.now()
      const savedItems: SaleItemRecord[] = editItems.map((it) => {
        const unitPrice = parseCurrencyCents(it._priceText) || Number(it.unitPrice || 0)
        const quantity = Number(it.quantity || 0)
        return {
          productId: it.productId ?? null,
          variationKey: it.variationKey ?? null,
          reservationItemId: it.reservationItemId ?? null,
          productName: it.productName,
          description: it.description,
          quantity,
          unitPrice,
          lineTotal: quantity * unitPrice,
          size: it.size ?? null,
          color: it.color ?? null,
        }
      })

      const beforeSnap: Partial<SaleRecord> = {
        ...sale,
      }

      const updates: Record<string, unknown> = {}

      updates[`sales/${sale.saleId}/items`] = savedItems
      updates[`sales/${sale.saleId}/notes`] = notes.trim() || null
      updates[`sales/${sale.saleId}/paymentMethod`] = paymentMethod || null
      updates[`sales/${sale.saleId}/originalTotalAmount`] =
        Number(sale.originalTotalAmount || sale.totalAmount || 0)
      updates[`sales/${sale.saleId}/discountValue`] = editTotals.finalDiscountValue
      updates[`sales/${sale.saleId}/discountPercent`] = editTotals.finalDiscountPercent
      updates[`sales/${sale.saleId}/discountApplied`] = editTotals.discountApplied
      updates[`sales/${sale.saleId}/totalAmount`] = editTotals.totalAmount
      updates[`sales/${sale.saleId}/totalItems`] = editTotals.totalItems
      updates[`sales/${sale.saleId}/updatedAt`] = now
      updates[`sales/${sale.saleId}/lastEditedBy`] = user.uid

      if (paymentMethod === 'amortizacao') {
        const currentPaid = Number(sale.paidAmount || 0)
        const currentDebt = Math.max(editTotals.totalAmount - currentPaid, 0)
        updates[`sales/${sale.saleId}/debtAmount`] = editTotals.totalAmount
        updates[`sales/${sale.saleId}/paymentStatus`] = currentDebt > 0 ? 'pending' : 'paid'
      } else {
        const paid = Number(sale.paidAmount || 0)
        updates[`sales/${sale.saleId}/debtAmount`] = null
        if (paid >= editTotals.totalAmount - 0.001) {
          updates[`sales/${sale.saleId}/paymentStatus`] = 'paid'
        } else {
          updates[`sales/${sale.saleId}/paymentStatus`] = sale.paymentStatus ?? 'paid'
        }
      }

      if (sale.customer?.customerId) {
        const customerSnap = await get(ref(rtdb, `customers/${sale.customer.customerId}`))
        if (customerSnap.exists()) {
          const customer = customerSnap.val() as CustomerRecord
          const oldTotal = Number(sale.totalAmount || 0)
          const delta = editTotals.totalAmount - oldTotal
          const currentPurchased = Number(customer.totalPurchased || 0)
          const nextPurchased = Math.max(0, currentPurchased + delta)
          updates[`customers/${sale.customer.customerId}/totalPurchased`] = nextPurchased

          if (paymentMethod === 'amortizacao') {
            const currentDebt = Number(customer.totalDebt || 0)
            const oldDebt = Math.max(oldTotal - Number(sale.paidAmount || 0), 0)
            const newDebt = Math.max(editTotals.totalAmount - Number(sale.paidAmount || 0), 0)
            const debtDelta = newDebt - oldDebt
            updates[`customers/${sale.customer.customerId}/totalDebt`] = Math.max(0, currentDebt + debtDelta)
          }
          updates[`customers/${sale.customer.customerId}/updatedAt`] = now
        }
      }

      const afterSnap: Partial<SaleRecord & { lastEditedBy?: string }> = {
        ...sale,
        items: savedItems,
        notes: notes.trim() || null,
        paymentMethod: paymentMethod || undefined,
        discountValue: editTotals.finalDiscountValue,
        discountPercent: editTotals.finalDiscountPercent,
        discountApplied: editTotals.discountApplied,
        totalAmount: editTotals.totalAmount,
        totalItems: editTotals.totalItems,
        updatedAt: now,
        lastEditedBy: user.uid,
        debtAmount:
          paymentMethod === 'amortizacao'
            ? editTotals.totalAmount
            : (sale.debtAmount ?? undefined),
      }

      const logRef = push(ref(rtdb, `saleEditLogs/${sale.saleId}`))
      const logId = logRef.key
      if (logId) {
        updates[`saleEditLogs/${sale.saleId}/${logId}`] = {
          logId,
          saleId: sale.saleId,
          editedBy: user.uid,
          editedByName: editingUserName || user.uid,
          editedAt: now,
          before: beforeSnap,
          after: afterSnap,
        }
      }

      await update(ref(rtdb), updates)
      onSuccess('Compra reaberta e salva com sucesso. As alterações foram registradas no histórico de edição.')
      onSaved()
    } catch (err) {
      console.error('Erro ao salvar reabertura da compra:', err)
      onError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações da compra.')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !sale) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reabrir compra"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: isMobile ? 8 : 24,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: logistaTheme.colors.surface,
          borderRadius: 20,
          width: '100%',
          maxWidth: 1200,
          display: 'grid',
          gap: 20,
          padding: isMobile ? 16 : 28,
          margin: 'auto 0',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <FiRefreshCw size={20} color={logistaTheme.colors.accentDark} />
              <h2 style={{ margin: 0, fontSize: 24 }}>Reabrir compra</h2>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 999,
                  fontSize: 12,
                  background: logistaTheme.colors.accentSoft,
                  color: logistaTheme.colors.accentDark,
                  border: `1px solid ${logistaTheme.colors.accentBorder}`,
                  fontWeight: 600,
                }}
              >
                #{sale.saleId?.slice(-6) || sale.saleId}
              </span>
            </div>
            <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
              <span>
                Data original:{' '}
                <strong style={{ color: logistaTheme.colors.text }}>
                  {formatDateTime(sale.createdAt)}
                </strong>
              </span>
              <span style={{ margin: '0 10px', opacity: 0.4 }}>·</span>
              <span>
                Editado por:{' '}
                <strong style={{ color: logistaTheme.colors.text }}>{editingUserName || user?.uid}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar reabrir compra"
            style={{
              border: `1px solid ${logistaTheme.colors.borderStrong}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
              width: 40,
              height: 40,
              borderRadius: 12,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiXSquare size={18} />
          </button>
        </header>

        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: isMobile ? '1fr' : '1.35fr 1fr',
          }}
        >
          <section style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiEdit2 size={16} />
                <h3 style={{ margin: 0, fontSize: 18 }}>Itens da venda</h3>
              </div>
              <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                Edite preço unitário e quantidade
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 10,
                fontSize: 12,
                color: logistaTheme.colors.textMuted,
                fontWeight: 700,
                padding: '0 4px',
                gridTemplateColumns: isMobile ? '1.2fr 1fr' : '2.2fr 1fr 1fr 1fr',
              }}
            >
              <span>Produto</span>
              {!isMobile ? <span>Qtd</span> : null}
              <span style={{ textAlign: 'right' }}>Unitário</span>
              <span style={{ textAlign: 'right' }}>Total</span>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {editItems.map((it, idx) => {
                const unit = parseCurrencyCents(it._priceText) || Number(it.unitPrice || 0)
                const line = Number(it.quantity || 0) * unit
                return (
                  <div
                    key={idx}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${logistaTheme.colors.border}`,
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '2.2fr 1fr 1fr 1fr',
                      gap: isMobile ? 10 : 12,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, wordBreak: 'break-word' }}>
                        {it.productName}
                      </div>
                      {(it.size || it.color) ? (
                        <div style={{ color: logistaTheme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                          {it.size || '-'}{it.color ? ` • ${it.color}` : ''}
                        </div>
                      ) : null}
                      {isMobile ? (
                        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 90px' }}>
                            <span style={{ fontSize: 11, color: logistaTheme.colors.textMuted }}>Qtd</span>
                            <input
                              type="number"
                              min={0}
                              value={it.quantity}
                              onChange={(e) => updateEditItemQty(idx, e.target.value)}
                              style={{ ...logistaInputStyle, padding: '6px 8px' }}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                    {!isMobile ? (
                      <input
                        type="number"
                        min={0}
                        value={it.quantity}
                        onChange={(e) => updateEditItemQty(idx, e.target.value)}
                        style={{ ...logistaInputStyle, padding: '6px 8px' }}
                      />
                    ) : null}
                    <div>
                      <input
                        inputMode="decimal"
                        value={it._priceText}
                        onChange={(e) => updateEditItemText(idx, e.target.value)}
                        onBlur={() => {
                          setEditItems((prev) => {
                            const curr = prev[idx]
                            if (!curr) return prev
                            const next = [...prev]
                            const unitPrice = parseCurrencyCents(curr._priceText) || Number(curr.unitPrice || 0)
                            next[idx] = {
                              ...curr,
                              unitPrice,
                              lineTotal: Number(curr.quantity || 0) * unitPrice,
                            }
                            return next
                          })
                        }}
                        placeholder="R$ 0,00"
                        style={{
                          ...logistaInputStyle,
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 10px',
                          textAlign: 'right',
                        }}
                      />
                    </div>
                    <div
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        color: logistaTheme.colors.text,
                      }}
                    >
                      {formatCurrency(line)}
                    </div>
                  </div>
                )
              })}
            </div>

            <label style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Observações da venda</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Informações adicionais sobre a venda (ex.: alteração de itens, troca, etc.)"
                style={{
                  ...logistaInputStyle,
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </label>
          </section>

          <section style={{ display: 'grid', gap: 20, alignContent: 'flex-start' }}>
            <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Pagamento</h3>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Forma de pagamento</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="pix">Pix</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de crédito</option>
                  <option value="cartao_debito">Cartão de débito</option>
                  <option value="boleto">Boleto</option>
                  <option value="transferencia">Transferência</option>
                  <option value="amortizacao">Amortização (pagamento parcial)</option>
                  <option value="outro">Outro</option>
                </select>
              </label>

              {paymentMethod === 'amortizacao' ? (
                <div
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${logistaTheme.colors.infoBorder ?? logistaTheme.colors.accentBorder}`,
                    background: logistaTheme.colors.infoBackground ?? logistaTheme.colors.accentSoft,
                    color: logistaTheme.colors.infoText ?? logistaTheme.colors.accentDark,
                    padding: '10px 12px',
                    fontSize: 12,
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Pagamento por Amortização</div>
                  <div>
                    O valor total será mantido/movido para o saldo devedor do cliente e baixado conforme pagamentos parciais.
                  </div>
                </div>
              ) : null}
            </section>

            <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Desconto</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                    Valor do desconto (R$)
                  </span>
                  <input
                    inputMode="decimal"
                    value={discountValueText}
                    onChange={(e) => handleEditDiscountValueChange(e.target.value)}
                    placeholder="R$ 0,00"
                    disabled={editTotals.subtotalItems <= 0}
                    style={{
                      ...logistaInputStyle,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                    }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                    Porcentagem do desconto (%)
                  </span>
                  <input
                    inputMode="decimal"
                    value={discountPercentText}
                    onChange={(e) => handleEditDiscountPercentChange(e.target.value)}
                    placeholder="0,00%"
                    disabled={editTotals.subtotalItems <= 0}
                    style={{
                      ...logistaInputStyle,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                    }}
                  />
                </label>
              </div>
              {editTotals.subtotalItems <= 0 ? (
                <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                  Adicione valores aos itens para aplicar desconto.
                </div>
              ) : null}
            </section>

            <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                <span>Itens</span>
                <strong>{editTotals.totalItems}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                <span>Subtotal</span>
                <strong>{formatCurrency(editTotals.subtotalItems)}</strong>
              </div>
              {editTotals.discountApplied ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: logistaTheme.colors.errorText, fontSize: 14 }}>
                  <span>Desconto ({editTotals.finalDiscountPercent.toFixed(2).replace('.', ',')}%)</span>
                  <strong>- {formatCurrency(editTotals.finalDiscountValue)}</strong>
                </div>
              ) : null}
              <div
                style={{
                  borderTop: `1px dashed ${logistaTheme.colors.border}`,
                  paddingTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 16,
                  color: logistaTheme.colors.text,
                }}
              >
                <span style={{ fontWeight: 700 }}>Total final</span>
                <strong style={{ fontSize: 24, fontWeight: 900 }}>
                  {formatCurrency(editTotals.totalAmount)}
                </strong>
              </div>
            </section>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: `1px solid ${logistaTheme.colors.borderStrong}`,
                  background: logistaTheme.colors.surface,
                  color: logistaTheme.colors.text,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                style={{
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: logistaTheme.colors.accent,
                  color: logistaTheme.colors.surface,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                <FiSave size={16} />
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
