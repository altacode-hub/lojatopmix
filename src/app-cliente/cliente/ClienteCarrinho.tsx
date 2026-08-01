import { useState } from 'react'
import { FiShoppingBag, FiTrash2 } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { formatCurrency, siteTheme } from '../siteTheme'

export default function ClienteCarrinho() {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { items, remove, clear, total } = useCart()

  const handleRemove = async (itemId: string) => {
    try {
      setProcessingId(itemId)
      setErrorMessage(null)
      await remove(itemId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel remover o item do carrinho.')
    } finally {
      setProcessingId(null)
    }
  }

  const handleClear = async () => {
    try {
      setClearing(true)
      setErrorMessage(null)
      await clear()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel limpar o carrinho.')
    } finally {
      setClearing(false)
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
        <h1 style={{ margin: 0, fontSize: 28, color: siteTheme.colors.text }}>Meu carrinho</h1>
        <p style={{ margin: '10px 0 0', color: siteTheme.colors.textMuted }}>
          Revise seus produtos antes de seguir para o checkout.
        </p>
      </section>

      {errorMessage ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${siteTheme.colors.errorBorder}`,
            background: siteTheme.colors.errorBackground,
            color: siteTheme.colors.errorText,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {items.length === 0 ? (
        <section
          style={{
            background: siteTheme.colors.surface,
            borderRadius: siteTheme.radius.lg,
            padding: 28,
            border: `1px dashed ${siteTheme.colors.primarySoftBorder}`,
            color: siteTheme.colors.textMuted,
            display: 'grid',
            gap: 12,
            justifyItems: 'start',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: siteTheme.colors.primarySoft,
              color: siteTheme.colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FiShoppingBag size={24} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: siteTheme.colors.text }}>Seu carrinho está vazio</div>
          <div>Adicione produtos na vitrine para iniciar uma compra.</div>
          <Link
            to="/"
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 18px',
              borderRadius: 12,
              background: siteTheme.colors.primary,
              color: siteTheme.colors.surface,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            Voltar para a loja
          </Link>
        </section>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            alignItems: 'start',
          }}
        >
          <section style={{ display: 'grid', gap: 14 }}>
            {items.map((item) => (
              <article
                key={item.id}
                style={{
                  background: siteTheme.colors.surface,
                  borderRadius: siteTheme.radius.md,
                  border: `1px solid ${siteTheme.colors.border}`,
                  padding: 18,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: siteTheme.colors.text }}>{item.name}</div>
                    <div style={{ marginTop: 6, color: siteTheme.colors.textMuted }}>Quantidade: {item.qty}</div>
                    {item.note ? <div style={{ marginTop: 6, color: siteTheme.colors.textMuted }}>Observação: {item.note}</div> : null}
                  </div>
                  <div style={{ fontWeight: 800, color: siteTheme.colors.primary }}>{formatCurrency(item.price * item.qty)}</div>
                </div>

                <button
                  onClick={() => void handleRemove(item.id)}
                  disabled={processingId === item.id}
                  style={{
                    width: 'fit-content',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: `1px solid ${siteTheme.colors.border}`,
                    background: siteTheme.colors.surface,
                    color: siteTheme.colors.text,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <FiTrash2 size={16} />
                  {processingId === item.id ? 'Removendo...' : 'Remover'}
                </button>
              </article>
            ))}
          </section>

          <aside
            style={{
              background: siteTheme.colors.surface,
              borderRadius: siteTheme.radius.lg,
              border: `1px solid ${siteTheme.colors.border}`,
              padding: 22,
              display: 'grid',
              gap: 14,
              position: 'sticky',
              top: 24,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 800, color: siteTheme.colors.text }}>Resumo</div>
            <div style={{ color: siteTheme.colors.textMuted }}>Itens: {items.length}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: siteTheme.colors.primary }}>{formatCurrency(total)}</div>

            <Link
              to="/cliente/checkout"
              style={{
                textDecoration: 'none',
                padding: '14px 16px',
                borderRadius: 12,
                background: siteTheme.colors.primary,
                color: siteTheme.colors.surface,
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              Continuar para pagamento
            </Link>

            <button
              onClick={() => void handleClear()}
              disabled={clearing}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${siteTheme.colors.border}`,
                background: siteTheme.colors.surface,
                color: siteTheme.colors.text,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {clearing ? 'Limpando...' : 'Limpar carrinho'}
            </button>
          </aside>
        </div>
      )}
    </div>
  )
}
