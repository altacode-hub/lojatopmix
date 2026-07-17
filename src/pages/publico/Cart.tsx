import { useState } from 'react'
import { useCart } from '../../context/CartContext'
import { Link } from 'react-router-dom'

export default function Cart() {
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
    <div>
      <h1>Carrinho</h1>
      {errorMessage ? <div style={{ marginBottom: 12, color: '#b45309' }}>{errorMessage}</div> : null}
      {items.length === 0 ? (
        <div>Seu carrinho está vazio</div>
      ) : (
        <>
          <ul>
            {items.map((i) => (
              <li key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <div>{i.name}</div>
                <div>Qtd: {i.qty}</div>
                <div>R$ {(i.price * i.qty).toFixed(2)}</div>
                <button onClick={() => void handleRemove(i.id)} disabled={processingId === i.id}>
                  {processingId === i.id ? 'Removendo...' : 'Remover'}
                </button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12, fontWeight: 600 }}>Total: R$ {total.toFixed(2)}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => void handleClear()} disabled={clearing}>
              {clearing ? 'Limpando...' : 'Limpar'}
            </button>
            <Link to="/checkout">
              <button>Continuar para checkout</button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
