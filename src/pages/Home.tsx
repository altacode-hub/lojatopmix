import { useCart } from '../context/CartContext'

const products = [
  { id: '1', name: 'Produto A', price: 99.9 },
  { id: '2', name: 'Produto B', price: 149.9 },
  { id: '3', name: 'Produto C', price: 59.9 },
]

export default function Home() {
  const { add } = useCart()
  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <img
          src="/topmix-banner.png"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement
            if (img.src.endsWith('/topmix-banner.png')) {
              img.src = '/topmix-icon.png'
            } else {
              img.style.display = 'none'
            }
          }}
          alt="Top Mix Store"
          style={{ height: 60, objectFit: 'contain' }}
        />
        <div style={{ fontSize: 28, fontWeight: 700 }}>Top Mix Store</div>
      </header>
      <h1>Top Mix Store</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {products.map((p) => (
          <div key={p.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ marginTop: 8 }}>R$ {p.price.toFixed(2)}</div>
            <button style={{ marginTop: 12 }} onClick={() => add({ id: p.id, name: p.name, price: p.price, qty: 1 })}>
              Adicionar ao carrinho
            </button>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <a href="https://lojatopmix.web.app/politicaPrivacidade" target="_blank" rel="noopener noreferrer">
          Política de Privacidade
        </a>
      </div>
    </div>
  )
}
