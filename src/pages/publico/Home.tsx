import { useNavigate } from 'react-router-dom'
import { products } from '../../data/products'

export default function Home() {
  const navigate = useNavigate()
  return (
    <div>
      <div style={{ fontWeight:  700, fontSize: 'var(--font-size-grande)', color: '#797979', wordBreak: 'break-word', textAlign: 'left', margin: '16px 0' }}>Produtos</div>
      <div className="products-grid">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            <img
              src={p.images[0]}
              alt={p.name}
              className="product-img"
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
              }}
            />
            <div className="product-body">
              <div style={{ color: '#334155', fontWeight: 600 }}>{p.name} {p.code}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>R$ {p.price.toFixed(2)}</div>
              <button
                onClick={() => navigate(`/produto/${p.id}`)}
                style={{
                  alignSelf: 'start',
                  background: '#b58516',
                  color: '#fff',
                }}
              >
                Comprar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
