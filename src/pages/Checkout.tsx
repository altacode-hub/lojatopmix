import { useCart } from '../context/CartContext'

export default function Checkout() {
  const { items, total } = useCart()
  return (
    <div style={{ padding: 24 }}>
      <h1>Checkout</h1>
      <ul>
        {items.map((i) => (
          <li key={i.id}>
            {i.name} x {i.qty} = R$ {(i.price * i.qty).toFixed(2)}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 12, fontWeight: 600 }}>Total: R$ {total.toFixed(2)}</div>
      <div style={{ marginTop: 12 }}>
        <button disabled>Pagamento EFI (em breve)</button>
      </div>
    </div>
  )
}
