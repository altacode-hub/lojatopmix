import { useEffect, useMemo, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import { FiEdit3, FiSave, FiXSquare } from 'react-icons/fi'
import { rtdb } from '../../../service/firebase'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'
import { cardStyle, formatCurrency, formatDateTime } from '../vendas/helpers'
import type { AmortizationRecord, CustomerRecord, SaleRecord } from '../vendas/types'

type AuthUserRef = { uid: string; phoneNumber: string | null } | null

type ClienteEditarPagamentoProps = {
  open: boolean
  amortization: AmortizationRecord | null
  sale: SaleRecord | null
  user: AuthUserRef
  isMobile: boolean
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (message: string) => void
  onSuccess: (message: string) => void
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const parseCurrencyCents = (value: string) => {
  const digitsOnly = value.replace(/\D/g, '')
  if (!digitsOnly) return 0
  return Number(digitsOnly) / 100
}

const getCurrencyDisplay = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return ''
  return currencyFormatter.format(value)
}

const paymentOptions: { value: AmortizationRecord['paymentMethod']; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'cartao_debito', label: 'Cartão de débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'outro', label: 'Outro' },
]

export default function ClienteEditarPagamento({
  open,
  amortization,
  sale,
  user,
  isMobile,
  onClose,
  onSaved,
  onError,
  onSuccess,
}: ClienteEditarPagamentoProps) {
  const [amountText, setAmountText] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [editingUserName, setEditingUserName] = useState<string>('')

  useEffect(() => {
    if (!amortization) return
    setAmountText(getCurrencyDisplay(Number(amortization.amount || 0)))
    setPaymentMethod(amortization.paymentMethod || 'dinheiro')
    setNotes(amortization.notes || '')
  }, [amortization])

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

  const maxAllowedAmount = useMemo(() => {
    if (!sale || !amortization) return 0
    const otherPaid = Math.max(
      0,
      Number(sale.paidAmount || 0) - Number(amortization.amount || 0),
    )
    const totalDebt = Number(sale.debtAmount || sale.totalAmount || 0)
    return Math.max(Number(amortization.amount || 0), totalDebt - otherPaid)
  }, [sale, amortization])

  if (!open || !amortization) return null

  const handleSave = async () => {
    if (!amortization || !user) {
      onError('Pagamento ou usuário não identificados para edição.')
      return
    }
    const nextAmount = parseCurrencyCents(amountText)
    if (nextAmount <= 0) {
      onError('Informe um valor válido para o pagamento.')
      return
    }

    setSaving(true)
    try {
      const now = Date.now()
      const beforeSnap: Partial<AmortizationRecord> = { ...amortization }

      const updates: Record<string, unknown> = {}
      updates[`amortizations/${amortization.amortizationId}/amount`] = nextAmount
      updates[`amortizations/${amortization.amortizationId}/paymentMethod`] = paymentMethod
      updates[`amortizations/${amortization.amortizationId}/notes`] = notes.trim() || null
      updates[`amortizations/${amortization.amortizationId}/lastEditedBy`] = user.uid
      updates[`amortizations/${amortization.amortizationId}/updatedAt`] = now

      if (sale) {
        const delta = nextAmount - Number(amortization.amount || 0)
        const nextPaidAmount = Math.max(0, Number(sale.paidAmount || 0) + delta)
        const totalDebt = Number(sale.debtAmount || sale.totalAmount || 0)
        const nextRemaining = Math.max(0, totalDebt - nextPaidAmount)
        const nextStatus = nextRemaining <= 0.001 ? 'paid' : 'pending'
        updates[`sales/${sale.saleId}/paidAmount`] = nextPaidAmount
        updates[`sales/${sale.saleId}/paymentStatus`] = nextStatus
        updates[`sales/${sale.saleId}/updatedAt`] = now
        if (nextStatus === 'paid' && !sale.paidAt) {
          updates[`sales/${sale.saleId}/paidAt`] = now
        }
        if (sale.customer?.customerId) {
          const customerSnap = await get(ref(rtdb, `customers/${sale.customer.customerId}`))
          if (customerSnap.exists()) {
            const customer = customerSnap.val() as CustomerRecord
            const currentPaid = Number(customer.totalPaid || 0)
            const nextCustomerPaid = Math.max(0, currentPaid + delta)
            const currentDebt = Number(customer.totalDebt || 0)
            const nextCustomerDebt = Math.max(0, currentDebt - delta)
            updates[`customers/${sale.customer.customerId}/totalPaid`] = nextCustomerPaid
            updates[`customers/${sale.customer.customerId}/totalDebt`] = nextCustomerDebt
            updates[`customers/${sale.customer.customerId}/updatedAt`] = now
          }
        }
      }

      const afterSnap: Partial<AmortizationRecord & { lastEditedBy?: string; updatedAt?: number }> = {
        ...amortization,
        amount: nextAmount,
        paymentMethod: paymentMethod as AmortizationRecord['paymentMethod'],
        notes: notes.trim() || null,
        lastEditedBy: user.uid,
        updatedAt: now,
      }

      const logRef = push(ref(rtdb, `amortizationEditLogs/${amortization.amortizationId}`))
      const logId = logRef.key
      if (logId) {
        updates[`amortizationEditLogs/${amortization.amortizationId}/${logId}`] = {
          logId,
          amortizationId: amortization.amortizationId,
          editedBy: user.uid,
          editedByName: editingUserName || user.uid,
          editedAt: now,
          before: beforeSnap,
          after: afterSnap,
        }
      }

      await update(ref(rtdb), updates)
      onSuccess('Pagamento atualizado com sucesso. As métricas da venda e do cliente foram ajustadas.')
      await onSaved()
    } catch (err) {
      console.error('Erro ao editar pagamento:', err)
      onError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações do pagamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar pagamento"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 120,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 8 : 24,
      }}
    >
      <div
        style={{
          background: logistaTheme.colors.surface,
          borderRadius: 20,
          width: '100%',
          maxWidth: 720,
          padding: isMobile ? 16 : 28,
          display: 'grid',
          gap: 20,
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
              <FiEdit3 size={20} color={logistaTheme.colors.accentDark} />
              <h2 style={{ margin: 0, fontSize: 22 }}>Editar pagamento</h2>
            </div>
            <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14, display: 'grid', gap: 2 }}>
              <span>
                Pagamento de:{' '}
                <strong style={{ color: logistaTheme.colors.text }}>
                  {formatCurrency(Number(amortization.amount || 0))}
                </strong>
              </span>
              <span>
                Data original:{' '}
                <strong style={{ color: logistaTheme.colors.text }}>
                  {formatDateTime(amortization.createdAt)}
                </strong>
              </span>
              <span>
                Venda: <strong style={{ color: logistaTheme.colors.text }}>#{sale?.saleId?.slice(-6) || amortization.saleId?.slice(-6)}</strong>
                {sale ? ` • Total R$ ${formatCurrency(Number(sale.totalAmount || 0))}` : ''}
              </span>
              <span>
                Editado por:{' '}
                <strong style={{ color: logistaTheme.colors.text }}>
                  {editingUserName || user?.uid}
                </strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar edição de pagamento"
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

        <section style={{ ...cardStyle, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>
                Valor do pagamento R$ <span style={{ color: logistaTheme.colors.errorText }}>*</span>
              </span>
              <input
                inputMode="decimal"
                value={amountText}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  if (!digits) {
                    setAmountText('')
                    return
                  }
                  const next = Math.min(Number(digits) / 100, maxAllowedAmount > 0 ? maxAllowedAmount : Number.POSITIVE_INFINITY)
                  setAmountText(currencyFormatter.format(next))
                }}
                placeholder="R$ 0,00"
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
              {maxAllowedAmount > 0 ? (
                <span style={{ fontSize: 11, color: logistaTheme.colors.textMuted }}>
                  Limite ajustado: {formatCurrency(maxAllowedAmount)}
                </span>
              ) : null}
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Forma de pagamento</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              >
                {paymentOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Observação</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Correção na forma de pagamento, ajuste no valor, etc."
              style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </label>
        </section>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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
      </div>
    </div>
  )
}
