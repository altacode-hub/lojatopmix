import { useCallback, useEffect, useMemo, useState } from 'react'
import { get, push, ref, update } from 'firebase/database'
import {
  FiArrowLeft,
  FiDollarSign,
  FiEdit,
  FiPlus,
  FiSearch,
  FiUser,
  FiUsers,
} from 'react-icons/fi'
import { useAuth } from '../../../context/AuthContext'
import { rtdb } from '../../../service/firebase'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'
import { cardStyle, formatCurrency } from '../vendas/helpers'
import type { AmortizationRecord, CustomerRecord, SaleRecord } from '../vendas/types'
import ClienteEdit from './ClienteEdit'
import ClienteDetalhe from './ClienteDetalhe'

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
      } else {
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
        <ClienteEdit
          isMobile={isMobile}
          customerForm={customerForm}
          setCustomerForm={setCustomerForm}
          editingCustomerId={editingCustomerId}
          savingCustomer={savingCustomer}
          resetForm={resetForm}
          handleSaveCustomer={handleSaveCustomer}
        />
      )}

      {view === 'detail' && (
        <ClienteDetalhe
          isMobile={isMobile}
          detailCustomer={detailCustomer}
          customerSales={customerSales}
          customerAmortizations={customerAmortizations}
          savingAmortization={savingAmortization}
          newAmortization={newAmortization}
          setNewAmortization={setNewAmortization}
          handleRegisterAmortization={handleRegisterAmortization}
          getSaleRemainingDebt={getSaleRemainingDebt}
          user={user}
          onReabrirSaved={async () => {
            await loadAllData()
          }}
          onPagamentoSaved={async () => {
            await loadAllData()
          }}
          setError={setError}
          setSuccessMessage={setSuccessMessage}
        />
      )}
    </div>
  )
}
