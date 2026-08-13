import { useCallback, useEffect, useMemo, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import {
  FiArrowLeft,
  FiDollarSign,
  FiEdit,
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiUser,
  FiUsers,
  FiXSquare,
} from 'react-icons/fi'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaInputStyle, logistaTheme } from './logistaTheme'
import { cardStyle, formatCurrency, formatDateTime } from './vendas/helpers'
import type { AmortizationRecord, CustomerRecord, SaleRecord } from './vendas/types'

type CustomerView = CustomerRecord & {
  computedDebt: number
  computedPurchased: number
  computedPaid: number
}

const emptyForm = (): Partial<CustomerRecord> => ({
  name: '',
  phone_number: '',
  birthDate: '',
  email: '',
  notes: '',
})

export default function ClientesLogista() {
  const { user } = useAuth()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [customers, setCustomers] = useState<CustomerView[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [amortizations, setAmortizations] = useState<AmortizationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list')
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [customerForm, setCustomerForm] = useState<Partial<CustomerRecord>>(emptyForm())
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null)

  const [savingCustomer, setSavingCustomer] = useState(false)
  const [savingAmortization, setSavingAmortization] = useState<string | null>(null)
  const [newAmortization, setNewAmortization] = useState<{
    saleId: string
    amountText: string
    paymentMethod: string
    notes: string
  }>({ saleId: '', amountText: '', paymentMethod: 'dinheiro', notes: '' })

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [customersResult, salesResult, amortizationsResult] = await Promise.allSettled([
        get(ref(rtdb, 'customers')),
        get(ref(rtdb, 'sales')),
        get(ref(rtdb, 'amortizations')),
      ])

      const loadedCustomers: CustomerView[] = []
      if (customersResult.status === 'fulfilled' && customersResult.value.exists()) {
        const data = customersResult.value.val() as Record<string, CustomerRecord>
        for (const [id, c] of Object.entries(data)) {
          loadedCustomers.push({
            ...c,
            customerId: c.customerId || id,
            computedDebt: 0,
            computedPurchased: 0,
            computedPaid: 0,
          })
        }
      }else{
        setError('Não foi possível carregar os clientes.')
        console.log(customersResult)
      }

      const loadedSales: SaleRecord[] = []
      if (salesResult.status === 'fulfilled' && salesResult.value.exists()) {
        const data = salesResult.value.val() as Record<string, SaleRecord>
        for (const [id, s] of Object.entries(data)) {
          loadedSales.push({ ...s, saleId: s.saleId || id })
        }
      }

      const loadedAmortizations: AmortizationRecord[] = []
      if (amortizationsResult.status === 'fulfilled' && amortizationsResult.value.exists()) {
        const data = amortizationsResult.value.val() as Record<string, AmortizationRecord>
        for (const [id, a] of Object.entries(data)) {
          loadedAmortizations.push({ ...a, amortizationId: a.amortizationId || id })
        }
      }

      for (const c of loadedCustomers) {
        const customerSales = loadedSales.filter(
          (s) => s.customer?.customerId === c.customerId && s.paymentMethod === 'amortizacao',
        )
        const customerAmortizations = loadedAmortizations.filter((a) => a.customerId === c.customerId)

        const purchased = customerSales.reduce((sum, s) => sum + Number(s.totalAmount || 0), 0)
        const paid = customerAmortizations.reduce((sum, a) => sum + Number(a.amount || 0), 0)
        const storedPaid = customerSales.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0)

        c.computedPurchased = Math.max(purchased, Number(c.totalPurchased || 0))
        c.computedPaid = Math.max(paid, storedPaid, Number(c.totalPaid || 0))
        c.computedDebt = Math.max(c.computedPurchased - c.computedPaid, 0)
      }

      loadedCustomers.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setCustomers(loadedCustomers)
      setSales(loadedSales)
      setAmortizations(loadedAmortizations)
    } catch (loadError) {
      console.error('Erro ao carregar clientes:', loadError)
      setError('Não foi possível carregar a lista de clientes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAllData()
  }, [loadAllData])

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return customers
    return customers.filter((c) => {
      return (
        (c.name || '').toLowerCase().includes(needle) ||
        (c.phone_number || '').toLowerCase().includes(needle) ||
        (c.email || '').toLowerCase().includes(needle)
      )
    })
  }, [customers, search])

  const detailCustomer = useMemo(() => {
    if (!detailCustomerId) return null
    return customers.find((c) => c.customerId === detailCustomerId) || null
  }, [customers, detailCustomerId])

  const customerSales = useMemo(() => {
    if (!detailCustomerId) return []
    return sales
      .filter((s) => s.customer?.customerId === detailCustomerId)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }, [detailCustomerId, sales])

  const customerAmortizations = useMemo(() => {
    if (!detailCustomerId) return []
    return amortizations
      .filter((a) => a.customerId === detailCustomerId)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }, [detailCustomerId, amortizations])

  const resetForm = () => {
    setCustomerForm(emptyForm())
    setEditingCustomerId(null)
    setView('list')
  }

  const openNewCustomer = () => {
    setCustomerForm(emptyForm())
    setEditingCustomerId(null)
    setError(null)
    setSuccessMessage(null)
    setView('form')
  }

  const openEditCustomer = (customer: CustomerRecord) => {
    setCustomerForm({ ...customer })
    setEditingCustomerId(customer.customerId)
    setError(null)
    setSuccessMessage(null)
    setView('form')
  }

  const openDetailCustomer = (customerId: string) => {
    setDetailCustomerId(customerId)
    setNewAmortization({ saleId: '', amountText: '', paymentMethod: 'dinheiro', notes: '' })
    setView('detail')
  }

  const handleSaveCustomer = async () => {
    if (!user) {
      setError('Usuário não autenticado para cadastrar cliente.')
      return
    }
    const name = (customerForm.name || '').trim()
    if (!name) {
      setError('Nome do cliente é obrigatório.')
      return
    }
    setSavingCustomer(true)
    setError(null)
    try {
      const now = Date.now()
      const updates: Record<string, unknown> = {}
      let customerId = editingCustomerId

      if (!customerId) {
        const refResult = push(ref(rtdb, 'customers'))
        customerId = refResult.key
        if (!customerId) throw new Error('Não foi possível gerar ID do cliente.')
        updates[`customers/${customerId}`] = {
          customerId,
          name,
          phone_number: customerForm.phone_number || null,
          birthDate: customerForm.birthDate || null,
          email: customerForm.email || null,
          notes: customerForm.notes || null,
          createdAt: now,
          updatedAt: now,
          totalDebt: 0,
          totalPurchased: 0,
          totalPaid: 0,
        }
      } else {
        updates[`customers/${customerId}/name`] = name
        updates[`customers/${customerId}/phone_number`] = customerForm.phone_number || null
        updates[`customers/${customerId}/birthDate`] = customerForm.birthDate || null
        updates[`customers/${customerId}/email`] = customerForm.email || null
        updates[`customers/${customerId}/notes`] = customerForm.notes || null
        updates[`customers/${customerId}/updatedAt`] = now
      }

      await update(ref(rtdb), updates)
      setSuccessMessage(editingCustomerId ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.')
      await loadAllData()
      resetForm()
    } catch (saveError) {
      console.error('Erro ao salvar cliente:', saveError)
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cliente.')
    } finally {
      setSavingCustomer(false)
    }
  }

  const parseCurrency = (value: string): number => {
    const digits = value.replace(/\D/g, '')
    if (!digits) return 0
    return Number(digits) / 100
  }

  const handleRegisterAmortization = async () => {
    if (!user || !detailCustomerId) return
    if (!newAmortization.saleId) {
      setError('Selecione a venda (débito) para qual o pagamento está sendo feito.')
      return
    }
    const amount = parseCurrency(newAmortization.amountText)
    if (amount <= 0) {
      setError('Informe um valor válido para o pagamento.')
      return
    }
    const targetSale = sales.find((s) => s.saleId === newAmortization.saleId)
    if (!targetSale) {
      setError('Venda selecionada não foi encontrada.')
      return
    }
    const remainingDebt = Math.max(Number(targetSale.debtAmount || targetSale.totalAmount || 0) - Number(targetSale.paidAmount || 0), 0)
    if (amount > remainingDebt + 0.001) {
      setError(`Valor informado ultrapassa o saldo devedor desta venda (${formatCurrency(remainingDebt)}).`)
      return
    }

    setSavingAmortization(targetSale.saleId)
    setError(null)
    try {
      const now = Date.now()
      const amortRef = push(ref(rtdb, 'amortizations'))
      const amortizationId = amortRef.key
      if (!amortizationId) throw new Error('Não foi possível gerar ID da amortização.')

      const updates: Record<string, unknown> = {}
      updates[`amortizations/${amortizationId}`] = {
        amortizationId,
        saleId: targetSale.saleId,
        customerId: detailCustomerId,
        amount,
        paymentMethod: newAmortization.paymentMethod,
        notes: newAmortization.notes.trim() || null,
        createdAt: now,
        createdBy: user.uid,
      }

      const nextPaid = Number(targetSale.paidAmount || 0) + amount
      const totalDebt = Number(targetSale.debtAmount || targetSale.totalAmount || 0)
      const nextCount = Number(targetSale.amortizationCount || 0) + 1
      const isFullyPaid = nextPaid + 0.001 >= totalDebt

      updates[`sales/${targetSale.saleId}/paidAmount`] = nextPaid
      updates[`sales/${targetSale.saleId}/amortizationCount`] = nextCount
      if (isFullyPaid) {
        updates[`sales/${targetSale.saleId}/paymentStatus`] = 'paid'
        updates[`sales/${targetSale.saleId}/paidAt`] = now
      }
      updates[`sales/${targetSale.saleId}/updatedAt`] = now

      const customer = customers.find((c) => c.customerId === detailCustomerId)
      if (customer) {
        const nextTotalPaid = Math.max(Number(customer.totalPaid || 0), customer.computedPaid) + amount
        const nextTotalDebt = Math.max(customer.computedDebt - amount, 0)
        updates[`customers/${detailCustomerId}/totalPaid`] = nextTotalPaid
        updates[`customers/${detailCustomerId}/totalDebt`] = nextTotalDebt
        updates[`customers/${detailCustomerId}/updatedAt`] = now
      }

      await update(ref(rtdb), updates)
      setSuccessMessage('Pagamento (amortização) registrado com sucesso.')
      setNewAmortization({ saleId: '', amountText: '', paymentMethod: 'dinheiro', notes: '' })
      await loadAllData()
    } catch (amortError) {
      console.error('Erro ao registrar amortização:', amortError)
      setError(amortError instanceof Error ? amortError.message : 'Não foi possível registrar o pagamento.')
    } finally {
      setSavingAmortization(null)
    }
  }

  const getSaleRemainingDebt = (sale: SaleRecord) => {
    const total = Number(sale.debtAmount || sale.totalAmount || 0)
    const paid = Number(sale.paidAmount || 0)
    return Math.max(total - paid, 0)
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? 16 : 24, display: 'grid', gap: 24 }}>
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
            <FiUsers size={20} />
            <h1 style={{ margin: 0, fontSize: 28 }}>
              {view === 'list' ? 'Clientes' : view === 'form' ? (editingCustomerId ? 'Editar Cliente' : 'Novo Cliente') : 'Detalhes do Cliente'}
            </h1>
          </div>
          <div style={{ color: logistaTheme.colors.textMuted }}>
            {view === 'list' && 'Gerencie os clientes cadastrados e seus débitos por amortização.'}
            {view === 'form' && 'Preencha os dados do cliente abaixo.'}
            {view === 'detail' && detailCustomer && 'Visualize compras, débitos e registre pagamentos (amortizações).'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {view !== 'list' && (
            <button
              onClick={() => {
                if (view === 'detail') {
                  setDetailCustomerId(null)
                  setView('list')
                } else {
                  resetForm()
                }
              }}
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
              Voltar
            </button>
          )}
          {view === 'list' && (
            <button
              onClick={openNewCustomer}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 12,
                border: 'none',
                background: logistaTheme.colors.accent,
                color: logistaTheme.colors.surface,
                fontWeight: 700,
                cursor: 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              <FiPlus size={16} />
              Novo Cliente
            </button>
          )}
        </div>
      </section>

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

      {view === 'list' && (
        <>
          <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>
                <FiSearch size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Buscar cliente
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busque por nome, telefone ou e-mail..."
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: logistaTheme.colors.textMuted, fontSize: 13 }}>
              <span>Total: {filteredCustomers.length} cliente(s)</span>
              <span>
                Saldo devedor total:{' '}
                <strong style={{ color: logistaTheme.colors.errorText }}>
                  {formatCurrency(filteredCustomers.reduce((sum, c) => sum + c.computedDebt, 0))}
                </strong>
              </span>
            </div>
          </section>

          {loading ? (
            <section style={cardStyle}>
              <div style={{ color: logistaTheme.colors.textMuted }}>Carregando clientes...</div>
            </section>
          ) : filteredCustomers.length === 0 ? (
            <section style={cardStyle}>
              <div style={{ color: logistaTheme.colors.textMuted }}>
                {search.trim() ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado ainda.'}
              </div>
            </section>
          ) : (
            <section
              style={{
                display: 'grid',
                gap: 16,
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
              }}
            >
              {filteredCustomers.map((c) => (
                <div
                  key={c.customerId}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    display: 'grid',
                    gap: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => openDetailCustomer(c.customerId)}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: logistaTheme.colors.accentSoft,
                        color: logistaTheme.colors.accentDark,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 16,
                        flex: '0 0 auto',
                      }}
                    >
                      {c.name?.charAt(0).toUpperCase() || <FiUser size={20} />}
                    </div>
                    <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                      <div style={{ fontWeight: 700, wordBreak: 'break-word' }}>{c.name}</div>
                      {c.phone_number ? (
                        <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>{c.phone_number}</div>
                      ) : null}
                    </div>
                  </div>

                  {c.birthDate ? (
                    <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                      Nascimento: {c.birthDate}
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 8,
                      fontSize: 12,
                      paddingTop: 8,
                      borderTop: `1px solid ${logistaTheme.colors.border}`,
                    }}
                  >
                    <div>
                      <div style={{ color: logistaTheme.colors.textMuted }}>Comprado</div>
                      <strong style={{ color: logistaTheme.colors.text }}>{formatCurrency(c.computedPurchased)}</strong>
                    </div>
                    <div>
                      <div style={{ color: logistaTheme.colors.textMuted }}>Pago</div>
                      <strong style={{ color: logistaTheme.colors.successText }}>{formatCurrency(c.computedPaid)}</strong>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      border: `1px solid ${c.computedDebt > 0 ? logistaTheme.colors.warningBorder : logistaTheme.colors.successBorder}`,
                      background: c.computedDebt > 0 ? logistaTheme.colors.warningBackground : logistaTheme.colors.successBackground,
                      color: c.computedDebt > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{c.computedDebt > 0 ? 'Saldo devedor' : 'Quitado'}</span>
                    <strong style={{ fontSize: 15 }}>{formatCurrency(c.computedDebt)}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditCustomer(c)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${logistaTheme.colors.borderStrong}`,
                        background: logistaTheme.colors.surface,
                        color: logistaTheme.colors.text,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <FiEdit size={14} />
                      Editar
                    </button>
                    <button
                      onClick={() => openDetailCustomer(c.customerId)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: `1px solid ${logistaTheme.colors.accentBorder}`,
                        background: logistaTheme.colors.accentSoft,
                        color: logistaTheme.colors.accentDark,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontWeight: 600,
                      }}
                    >
                      <FiDollarSign size={14} />
                      Débitos
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {view === 'form' && (
        <section style={{ ...cardStyle, display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>
                Nome completo <span style={{ color: logistaTheme.colors.errorText }}>*</span>
              </span>
              <input
                value={customerForm.name || ''}
                onChange={(e) => setCustomerForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Nome do cliente"
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Telefone / WhatsApp</span>
              <input
                value={customerForm.phone_number || ''}
                onChange={(e) => setCustomerForm((s) => ({ ...s, phone_number: e.target.value }))}
                placeholder="(00) 00000-0000"
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Data de nascimento</span>
              <input
                type="date"
                value={customerForm.birthDate || ''}
                onChange={(e) => setCustomerForm((s) => ({ ...s, birthDate: e.target.value }))}
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>E-mail</span>
              <input
                type="email"
                value={customerForm.email || ''}
                onChange={(e) => setCustomerForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="cliente@email.com"
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>Observações</span>
            <textarea
              value={customerForm.notes || ''}
              onChange={(e) => setCustomerForm((s) => ({ ...s, notes: e.target.value }))}
              rows={4}
              placeholder="Informações adicionais sobre o cliente"
              style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={resetForm}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${logistaTheme.colors.borderStrong}`,
                background: logistaTheme.colors.surface,
                color: logistaTheme.colors.text,
                cursor: savingCustomer ? 'not-allowed' : 'pointer',
                opacity: savingCustomer ? 0.6 : 1,
              }}
              disabled={savingCustomer}
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSaveCustomer()}
              disabled={savingCustomer}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                border: 'none',
                background: logistaTheme.colors.accent,
                color: logistaTheme.colors.surface,
                fontWeight: 700,
                cursor: savingCustomer ? 'not-allowed' : 'pointer',
                opacity: savingCustomer ? 0.7 : 1,
              }}
            >
              {savingCustomer ? 'Salvando...' : editingCustomerId ? 'Salvar alterações' : 'Cadastrar cliente'}
            </button>
          </div>
        </section>
      )}

      {view === 'detail' && detailCustomer && (
        <div style={{ display: 'grid', gap: 24 }}>
          <section style={{ ...cardStyle, display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: logistaTheme.colors.accentSoft,
                  color: logistaTheme.colors.accentDark,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 24,
                  flex: '0 0 auto',
                }}
              >
                {detailCustomer.name?.charAt(0).toUpperCase() || <FiUser size={28} />}
              </div>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <h2 style={{ margin: 0, fontSize: 22 }}>{detailCustomer.name}</h2>
                {detailCustomer.phone_number ? (
                  <div style={{ color: logistaTheme.colors.textMuted, marginTop: 4 }}>
                    📞 {detailCustomer.phone_number}
                  </div>
                ) : null}
                {detailCustomer.birthDate ? (
                  <div style={{ color: logistaTheme.colors.textMuted, marginTop: 2 }}>
                    🎂 Nascimento: {detailCustomer.birthDate}
                  </div>
                ) : null}
                {detailCustomer.email ? (
                  <div style={{ color: logistaTheme.colors.textMuted, marginTop: 2 }}>
                    ✉️ {detailCustomer.email}
                  </div>
                ) : null}
                {detailCustomer.notes ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 10,
                      background: logistaTheme.colors.surfaceAlt,
                      border: `1px dashed ${logistaTheme.colors.border}`,
                      fontSize: 13,
                      color: logistaTheme.colors.textMuted,
                    }}
                  >
                    <strong style={{ color: logistaTheme.colors.text }}>Obs.:</strong> {detailCustomer.notes}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 10,
                  minWidth: isMobile ? '100%' : 360,
                }}
              >
                <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${logistaTheme.colors.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>Total comprado</div>
                  <div style={{ fontWeight: 800, marginTop: 4 }}>{formatCurrency(detailCustomer.computedPurchased)}</div>
                </div>
                <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${logistaTheme.colors.successBorder}`, background: logistaTheme.colors.successBackground, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: logistaTheme.colors.successText }}>Total pago</div>
                  <div style={{ fontWeight: 800, marginTop: 4, color: logistaTheme.colors.successText }}>
                    {formatCurrency(detailCustomer.computedPaid)}
                  </div>
                </div>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: `1px solid ${detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningBorder : logistaTheme.colors.successBorder}`,
                    background: detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningBackground : logistaTheme.colors.successBackground,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, color: detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText }}>
                    {detailCustomer.computedDebt > 0 ? 'Devendo' : 'Quitado'}
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      marginTop: 4,
                      color: detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText,
                    }}
                  >
                    {formatCurrency(detailCustomer.computedDebt)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {customerSales.some((s) => getSaleRemainingDebt(s) > 0) ? (
            <section
              style={{
                ...cardStyle,
                display: 'grid',
                gap: 14,
                border: `1px solid ${logistaTheme.colors.infoBorder ?? logistaTheme.colors.accentBorder}`,
                background: logistaTheme.colors.infoBackground ?? logistaTheme.colors.accentSoft,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FiDollarSign size={18} />
                <h3 style={{ margin: 0, fontSize: 18 }}>Registrar pagamento (amortização)</h3>
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr' }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>
                    Venda em aberto <span style={{ color: logistaTheme.colors.errorText }}>*</span>
                  </span>
                  <select
                    value={newAmortization.saleId}
                    onChange={(e) => setNewAmortization((s) => ({ ...s, saleId: e.target.value }))}
                    style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="">Selecione a venda...</option>
                    {customerSales
                      .filter((s) => getSaleRemainingDebt(s) > 0)
                      .map((s) => (
                        <option key={s.saleId} value={s.saleId}>
                          {formatDateTime(s.createdAt)} • {formatCurrency(getSaleRemainingDebt(s))} em aberto • {s.totalItems || 0} itens
                        </option>
                      ))}
                  </select>
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>
                    Valor do pagamento R$ <span style={{ color: logistaTheme.colors.errorText }}>*</span>
                  </span>
                  <input
                    value={newAmortization.amountText}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      const reais = digits ? Number(digits) / 100 : 0
                      setNewAmortization((s) => ({
                        ...s,
                        amountText: reais > 0 ? formatCurrency(reais).replace('R$', '').trim() : '',
                      }))
                    }}
                    placeholder="R$ 0,00"
                    style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Forma de pagamento</span>
                  <select
                    value={newAmortization.paymentMethod}
                    onChange={(e) => setNewAmortization((s) => ({ ...s, paymentMethod: e.target.value }))}
                    style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">Pix</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="cartao_debito">Cartão de débito</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="outro">Outro</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Observação (opcional)</span>
                <input
                  value={newAmortization.notes}
                  onChange={(e) => setNewAmortization((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Ex.: Pago em dinheiro no balcão"
                  style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => void handleRegisterAmortization()}
                  disabled={!!savingAmortization}
                  style={{
                    padding: '12px 20px',
                    borderRadius: 12,
                    border: 'none',
                    background: logistaTheme.colors.successText ?? logistaTheme.colors.accent,
                    color: logistaTheme.colors.surface,
                    fontWeight: 700,
                    cursor: savingAmortization ? 'not-allowed' : 'pointer',
                    opacity: savingAmortization ? 0.7 : 1,
                  }}
                >
                  {savingAmortization ? 'Registrando...' : '✓ Registrar pagamento'}
                </button>
              </div>
            </section>
          ) : null}

          <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FiShoppingCart size={18} />
              <h3 style={{ margin: 0, fontSize: 18 }}>Compras do cliente</h3>
            </div>
            {customerSales.length === 0 ? (
              <div style={{ color: logistaTheme.colors.textMuted }}>Este cliente ainda não possui compras registradas.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {customerSales.map((s) => {
                  const remaining = getSaleRemainingDebt(s)
                  const isAmort = s.paymentMethod === 'amortizacao'
                  return (
                    <div
                      key={s.saleId}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: `1px solid ${logistaTheme.colors.border}`,
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>
                            {s.channel === 'balcao' ? 'Venda no balcão' : s.channel === 'online' ? 'Compra online' : s.channel} •{' '}
                            <span style={{ color: logistaTheme.colors.textMuted, fontWeight: 500 }}>
                              {formatDateTime(s.createdAt)}
                            </span>
                          </div>
                          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>
                            {s.totalItems || 0} item(ns) • Código: {s.saleId}
                          </div>
                          {isAmort ? (
                            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 12,
                                  background: logistaTheme.colors.accentSoft,
                                  color: logistaTheme.colors.accentDark,
                                  border: `1px solid ${logistaTheme.colors.accentBorder}`,
                                }}
                              >
                                Pagamento por amortização
                              </span>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  fontSize: 12,
                                  background: remaining > 0 ? logistaTheme.colors.warningBackground : logistaTheme.colors.successBackground,
                                  color: remaining > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText,
                                  border: `1px solid ${remaining > 0 ? logistaTheme.colors.warningBorder : logistaTheme.colors.successBorder}`,
                                }}
                              >
                                {remaining > 0 ? `Em aberto: ${formatCurrency(remaining)}` : 'Quitada'}
                              </span>
                            </div>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: 6,
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontSize: 12,
                                background: logistaTheme.colors.successBackground,
                                color: logistaTheme.colors.successText,
                                border: `1px solid ${logistaTheme.colors.successBorder}`,
                              }}
                            >
                              Pago integralmente
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>Total da venda</div>
                          <div style={{ fontWeight: 800, fontSize: 18 }}>{formatCurrency(Number(s.totalAmount || 0))}</div>
                          {isAmort ? (
                            <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted, marginTop: 4 }}>
                              Pago: <strong style={{ color: logistaTheme.colors.successText }}>{formatCurrency(Number(s.paidAmount || 0))}</strong>
                              {' / '}
                              Restante: <strong style={{ color: logistaTheme.colors.warningText }}>{formatCurrency(remaining)}</strong>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {s.notes ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: logistaTheme.colors.textMuted,
                            padding: 8,
                            borderRadius: 8,
                            background: logistaTheme.colors.surfaceAlt,
                          }}
                        >
                          📝 {s.notes}
                        </div>
                      ) : null}

                      <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                        {s.items?.map((it, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                            <span>
                              • {it.productName}
                              {it.size || it.color ? ` (${it.size || '-'}${it.color ? ` • ${it.color}` : ''})` : ''}
                              {it.quantity > 1 ? ` ×${it.quantity}` : ''}
                            </span>
                            <span style={{ color: logistaTheme.colors.textMuted }}>{formatCurrency(Number(it.lineTotal || 0))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FiXSquare size={18} />
              <h3 style={{ margin: 0, fontSize: 18 }}>Histórico de pagamentos (amortizações)</h3>
            </div>
            {customerAmortizations.length === 0 ? (
              <div style={{ color: logistaTheme.colors.textMuted }}>
                Nenhum pagamento por amortização registrado para este cliente.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 1fr 1fr 1fr',
                    gap: 10,
                    fontSize: 12,
                    color: logistaTheme.colors.textMuted,
                    fontWeight: 700,
                    padding: '0 8px',
                  }}
                >
                  <span>Data</span>
                  <span>Venda</span>
                  <span style={{ textAlign: isMobile ? 'right' : 'center' }}>Forma</span>
                  <span style={{ textAlign: 'right' }}>Valor</span>
                </div>
                {customerAmortizations.map((a) => (
                  <div
                    key={a.amortizationId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 1fr 1fr 1fr',
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      border: `1px solid ${logistaTheme.colors.border}`,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ fontSize: 13 }}>{formatDateTime(a.createdAt)}</div>
                    <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                      #{a.saleId?.slice(-6) || '-'}
                    </div>
                    <div style={{ textAlign: isMobile ? 'right' : 'center', fontSize: 13, textTransform: 'capitalize' }}>
                      {a.paymentMethod?.replace('_', ' ') || 'dinheiro'}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 800, color: logistaTheme.colors.successText }}>
                      + {formatCurrency(Number(a.amount || 0))}
                    </div>
                    {a.notes ? (
                      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: logistaTheme.colors.textMuted }}>
                        📝 {a.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
