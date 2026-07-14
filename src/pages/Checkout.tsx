import { useMemo, useState } from 'react'
import { createPayment } from '../api/payment'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

type CheckoutFormState = {
  customerName: string
  customerEmail: string
  customerPhone: string
  addressCep: string
  addressNumber: string
  addressComplement: string
}

const CHECKOUT_ATTEMPT_STORAGE_KEY = 'infinitepay_checkout_attempt'

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

export default function Checkout() {
  const { items, total, cartId } = useCart()
  const { user } = useAuth()
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

  const checkoutItems = useMemo(
    () =>
      items.map((item) => ({
        itemId: item.id,
        quantity: item.qty,
        price: Math.round(item.price * 100),
        description: item.name,
        productId: item.productId,
        variationKey: item.variationKey,
        note: item.note,
      })),
    [items],
  )

  const handleInputChange = (field: keyof CheckoutFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
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
        items: checkoutItems,
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
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Checkout</h1>
      <p>Revise os itens do pedido e gere o link de pagamento da InfinitePay.</p>

      <div
        style={{
          display: 'grid',
          gap: 24,
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          alignItems: 'start',
        }}
      >
        <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h2>Resumo do pedido</h2>
          {items.length === 0 ? (
            <p>Seu carrinho esta vazio.</p>
          ) : (
            <ul style={{ paddingLeft: 20 }}>
              {items.map((item) => (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  {item.name} x {item.qty} = {formatCurrency(item.price * item.qty)}
                </li>
              ))}
            </ul>
          )}

          <div style={{ marginTop: 16, fontWeight: 600 }}>Total: {formatCurrency(total)}</div>
          <p style={{ marginTop: 8, color: '#555' }}>Os valores sao enviados para a InfinitePay em centavos.</p>
        </section>

        <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h2>Dados do comprador</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Nome</span>
              <input
                type="text"
                value={form.customerName}
                onChange={(event) => handleInputChange('customerName', event.target.value)}
                placeholder="Nome completo"
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>E-mail</span>
              <input
                type="email"
                value={form.customerEmail}
                onChange={(event) => handleInputChange('customerEmail', event.target.value)}
                placeholder="cliente@exemplo.com"
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Telefone</span>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(event) => handleInputChange('customerPhone', event.target.value)}
                placeholder="+5511999999999"
              />
            </label>
          </div>

          <h2 style={{ marginTop: 24 }}>Endereco de entrega</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>CEP</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.addressCep}
                onChange={(event) => handleInputChange('addressCep', event.target.value)}
                placeholder="12345678"
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Numero</span>
              <input
                type="text"
                value={form.addressNumber}
                onChange={(event) => handleInputChange('addressNumber', event.target.value)}
                placeholder="123"
              />
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6, marginTop: 12 }}>
            <span>Complemento</span>
            <input
              type="text"
              value={form.addressComplement}
              onChange={(event) => handleInputChange('addressComplement', event.target.value)}
              placeholder="Apartamento, bloco, referencia"
            />
          </label>

          <p style={{ marginTop: 12, color: '#555' }}>
            Nome, dados do comprador e endereco sao opcionais, mas ajudam a preencher o checkout.
          </p>

          {error ? (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 8,
                background: '#fff4f4',
                color: '#9b1c1c',
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <button onClick={handleCheckout} disabled={loading || items.length === 0}>
              {loading ? 'Gerando link...' : 'Pagar com InfinitePay'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
