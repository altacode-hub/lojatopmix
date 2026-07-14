import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { paymentStatus, type PaymentStatusResponse } from '../api/payment'
import { useCart } from '../context/CartContext'

type StoredCheckoutAttempt = {
  orderNsu: string
  total: number
  createdAt: string
}

const CHECKOUT_ATTEMPT_STORAGE_KEY = 'infinitepay_checkout_attempt'

const formatCurrencyFromCents = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100)

const readStoredCheckoutAttempt = (): StoredCheckoutAttempt | null => {
  const rawValue = sessionStorage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as StoredCheckoutAttempt
  } catch {
    return null
  }
}

export default function CheckoutReturn() {
  const [searchParams] = useSearchParams()
  const { clear } = useCart()
  const [verification, setVerification] = useState<PaymentStatusResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'pending' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  const params = useMemo(
    () => ({
      orderNsu: searchParams.get('order_nsu')?.trim() || '',
      transactionNsu: searchParams.get('transaction_nsu')?.trim() || '',
      slug: searchParams.get('slug')?.trim() || '',
      captureMethod: searchParams.get('capture_method')?.trim() || '',
      receiptUrl: searchParams.get('receipt_url')?.trim() || '',
    }),
    [searchParams],
  )

  const storedAttempt = useMemo(() => readStoredCheckoutAttempt(), [])

  useEffect(() => {
    const verifyPayment = async () => {
      if (!params.orderNsu || !params.transactionNsu || !params.slug) {
        setStatus('error')
        setError('Nao foi possivel validar o pagamento porque os parametros de retorno estao incompletos.')
        return
      }

      try {
        const result = await paymentStatus({
          orderNsu: params.orderNsu,
          transactionNsu: params.transactionNsu,
          slug: params.slug,
        })

        setVerification(result)

        if (result.success && result.paid) {
          await clear({ releaseReservations: false })
          sessionStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY)
          setStatus('success')
          return
        }

        setStatus('pending')
        setError('O pagamento ainda nao aparece como aprovado na verificacao da InfinitePay.')
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Nao foi possivel consultar o status do pagamento.')
      }
    }

    void verifyPayment()
  }, [clear, params.orderNsu, params.slug, params.transactionNsu])

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>Retorno do pagamento</h1>
      <p>Esta pagina consulta o backend da loja para confirmar o pagamento com seguranca.</p>

      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginTop: 16 }}>
        <h2>Status</h2>
        {status === 'loading' ? <p>Validando pagamento...</p> : null}
        {status === 'success' ? <p>Pagamento aprovado com sucesso.</p> : null}
        {status === 'pending' ? <p>Pagamento ainda nao confirmado.</p> : null}
        {status === 'error' && error ? <p>{error}</p> : null}

        {verification ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            <div>Valor do pedido: {formatCurrencyFromCents(verification.amount)}</div>
            <div>Valor pago: {formatCurrencyFromCents(verification.paid_amount)}</div>
            <div>Parcelas: {verification.installments}</div>
            <div>Metodo: {verification.capture_method}</div>
            <div>Pago: {verification.paid ? 'Sim' : 'Nao'}</div>
            <div>Origem da confirmacao: {verification.source || '-'}</div>
          </div>
        ) : null}

        {params.receiptUrl ? (
          <div style={{ marginTop: 16 }}>
            <a href={params.receiptUrl} target="_blank" rel="noreferrer">
              Abrir comprovante
            </a>
          </div>
        ) : null}
      </section>

      <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, marginTop: 16 }}>
        <h2>Referencia do retorno</h2>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>order_nsu: {params.orderNsu || '-'}</div>
          <div>transaction_nsu: {params.transactionNsu || '-'}</div>
          <div>slug: {params.slug || '-'}</div>
          <div>capture_method: {params.captureMethod || '-'}</div>
          <div>Ultima tentativa local: {storedAttempt?.orderNsu || '-'}</div>
        </div>
      </section>

      <div style={{ marginTop: 24 }}>
        <Link to="/">Voltar para a vitrine</Link>
      </div>
    </div>
  )
}
