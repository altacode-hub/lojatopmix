import { useCart } from '../../context/CartContext'
import { Link } from 'react-router-dom'

export default function Cart() {
  const { items, remove, clear, total } = useCart()
  return (
    <div>
      <h1>Carrinho</h1>
      {items.length === 0 ? (
        <div>Seu carrinho está vazio</div>
      ) : (
        <>
          <ul>
            {items.map((i) => (
              <li key={i.id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                <div>{i.name}</div>
                <div>Qtd: {i.qty}</div>
                <div>R$ {(i.price * i.qty).toFixed(2)}</div>
                <button onClick={() => remove(i.id)}>Remover</button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 12, fontWeight: 600 }}>Total: R$ {total.toFixed(2)}</div>
          <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <button onClick={clear}>Limpar</button>
            <Link to="/checkout">
              <button>Continuar para checkout</button>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
