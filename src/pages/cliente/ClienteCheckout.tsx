import { useEffect, useMemo, useState } from 'react'
import { createPayment, type CheckoutOrderItem } from './payment'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { formatCurrency, siteTheme } from '../siteTheme'
import { getClienteAddresses, toUppercaseInput } from './clientStorage'

type CheckoutFormState = {
  customerName: string
  customerEmail: string
  customerPhone: string
  addressCep: string
  addressNumber: string
  addressComplement: string
}

const CHECKOUT_ATTEMPT_STORAGE_KEY = 'infinitepay_checkout_attempt'

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 12,
  border: `1px solid ${siteTheme.colors.borderStrong}`,
  outline: 'none',
  background: siteTheme.colors.surface,
  color: siteTheme.colors.text,
  boxSizing: 'border-box' as const,
  textTransform: 'uppercase' as const,
}

export default function ClienteCheckout() {
  const { items, total, cartId } = useCart()
  const { user, clientProfile } = useAuth()
  const storageKey = user?.uid || 'anonimo'
  const [form, setForm] = useState<CheckoutFormState>({
    customerName: '',
    customerEmail: '',
    customerPhone: user?.phoneNumber || '',
    addressCep: '',
    addressNumber: '',
    addressComplement: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const address = getClienteAddresses(storageKey)[0]

    setForm((current) => ({
      ...current,
      customerName: current.customerName || clientProfile?.fullName || '',
      customerEmail: current.customerEmail || clientProfile?.email || '',
      customerPhone: current.customerPhone || clientProfile?.phone || user?.phoneNumber || '',
      addressCep: current.addressCep || address?.zipCode || '',
      addressNumber: current.addressNumber || address?.number || '',
      addressComplement: current.addressComplement || address?.complement || '',
    }))
  }, [clientProfile?.email, clientProfile?.fullName, clientProfile?.phone, storageKey, user?.phoneNumber])

  const checkoutOrderItems = useMemo<CheckoutOrderItem[]>(
    () =>
      items.map((item) => ({
        itemId: item.id,
        quantity: item.qty,
        price: Math.round(item.price * 100),
        description: item.name,
        productId: item.productId,
        variationKey: item.variationKey,
        note: item.note || "",
      })),
    [items],
  )

  const handleInputChange = (field: keyof CheckoutFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: toUppercaseInput(value),
    }))
  }

  const handleCheckout = async () => {
    if (items.length === 0) {
      setError('Seu carrinho esta vazio.')
      return
    }

    const customerName = form.customerName.trim()
    const customerEmail = form.customerEmail.trim()
    const customerPhone = form.customerPhone.trim()
    const cep = form.addressCep.replace(/\D/g, '')
    const addressNumber = form.addressNumber.trim()
    const addressComplement = form.addressComplement.trim()

    if (form.addressCep && cep.length !== 8) {
      setError('Informe um CEP com 8 digitos.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const customer =
        customerName.length > 0
          ? {
              name: customerName,
              email: customerEmail || undefined,
              phone_number: customerPhone || undefined,
            }
          : undefined

      const address =
        cep && addressNumber
          ? {
              cep,
              number: addressNumber,
              complement: addressComplement || undefined,
            }
          : undefined

      const { url, orderNsu } = await createPayment({
        cartId,
        orderItems: checkoutOrderItems,
        customer,
        address,
      })

      sessionStorage.setItem(
        CHECKOUT_ATTEMPT_STORAGE_KEY,
        JSON.stringify({
          orderNsu,
          total,
          createdAt: new Date().toISOString(),
        }),
      )

      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel iniciar o pagamento.')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section
        style={{
          background: siteTheme.colors.surface,
          borderRadius: siteTheme.radius.lg,
          padding: 24,
          border: `1px solid ${siteTheme.colors.border}`,
          boxShadow: siteTheme.shadow.card,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: siteTheme.colors.text }}>Pagamento</h1>
        <p style={{ margin: '10px 0 0', color: siteTheme.colors.textMuted }}>
          Revise os itens do pedido e gere o link de pagamento da InfinitePay.
        </p>
      </section>

      <div
        style={{
          display: 'grid',
          gap: 24,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'start',
        }}
      >
        <section
          style={{
            background: siteTheme.colors.surface,
            borderRadius: siteTheme.radius.lg,
            border: `1px solid ${siteTheme.colors.border}`,
            padding: 20,
          }}
        >
          <h2 style={{ marginTop: 0, color: siteTheme.colors.text }}>Resumo do pedido</h2>
          {items.length === 0 ? (
            <p style={{ color: siteTheme.colors.textMuted }}>Seu carrinho esta vazio.</p>
          ) : (
            <ul style={{ paddingLeft: 20, margin: 0, color: siteTheme.colors.text }}>
              {items.map((item) => (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  {item.name} x {item.qty} = {formatCurrency(item.price * item.qty)}
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: 16, fontWeight: 800, color: siteTheme.colors.primary, fontSize: 24 }}>
            Total: {formatCurrency(total)}
          </div>
        </section>

        <section
          style={{
            background: siteTheme.colors.surface,
            borderRadius: siteTheme.radius.lg,
            border: `1px solid ${siteTheme.colors.border}`,
            padding: 20,
            display: 'grid',
            gap: 16,
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, color: siteTheme.colors.text }}>Dados do comprador</h2>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Nome</span>
              <input
                type="text"
                value={form.customerName}
                onChange={(event) => handleInputChange('customerName', event.target.value)}
                placeholder="Nome completo"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>E-mail</span>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(event) => handleInputChange('customerEmail', event.target.value)}
                placeholder="cliente@exemplo.com"
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Telefone</span>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(event) => handleInputChange('customerPhone', event.target.value)}
                placeholder="+5511999999999"
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, color: siteTheme.colors.text }}>Endereco de entrega</h2>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>CEP</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.addressCep}
                  onChange={(event) => handleInputChange('addressCep', event.target.value)}
                  placeholder="12345678"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span>Numero</span>
                <input
                  type="text"
                  value={form.addressNumber}
                  onChange={(event) => handleInputChange('addressNumber', event.target.value)}
                  placeholder="123"
                  style={inputStyle}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Complemento</span>
              <input
                type="text"
                value={form.addressComplement}
                onChange={(event) => handleInputChange('addressComplement', event.target.value)}
                placeholder="Apartamento, bloco, referencia"
                style={inputStyle}
              />
            </label>
          </div>

          <p style={{ margin: 0, color: siteTheme.colors.textMuted }}>
            Nome, dados do comprador e endereco sao opcionais, mas ajudam a preencher o checkout.
          </p>

          {error ? (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${siteTheme.colors.errorBorder}`,
                background: siteTheme.colors.errorBackground,
                color: siteTheme.colors.errorText,
              }}
            >
              {error}
            </div>
          ) : null}

          <div>
            <button
              onClick={() => void handleCheckout()}
              disabled={loading || items.length === 0}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: 'none',
                background: loading || items.length === 0 ? siteTheme.colors.primaryMuted : siteTheme.colors.primary,
                color: siteTheme.colors.surface,
                fontWeight: 700,
                cursor: loading || items.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Gerando link...' : 'Pagar com InfinitePay'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
