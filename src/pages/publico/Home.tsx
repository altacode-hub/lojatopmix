import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onValue, ref } from 'firebase/database'
import { rtdb } from '../../service/firebase'
import type { ShowcaseRecord } from '../../types/catalog'
import { showcaseToArray } from '../../utils/catalog'

export default function Home() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Array<{ id: string } & ShowcaseRecord>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const showcaseRef = ref(rtdb, 'showcase')
    const unsubscribe = onValue(
      showcaseRef,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.val() as Record<string, ShowcaseRecord>) : null
        setProducts(showcaseToArray(data))
        setLoading(false)
      },
      (error) => {
        console.error('Erro ao carregar vitrine:', error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [])

  return (
    <div>
      <div style={{ fontWeight:  700, fontSize: 'var(--font-size-grande)', color: '#797979', wordBreak: 'break-word', textAlign: 'left', margin: '16px 0' }}>Produtos</div>
      {loading && <div style={{ color: '#6b7280', textAlign: 'left' }}>Carregando vitrine...</div>}
      {!loading && products.length === 0 && (
        <div style={{ color: '#6b7280', textAlign: 'left' }}>
          Nenhum produto publicado na vitrine no momento.
        </div>
      )}
      <div className="products-grid">
        {products.map((p) => (
          <div key={p.id} className="product-card">
            {p.image ? (
              <img
                src={p.image}
                alt={p.name}
                className="product-img"
                onError={(e) => {
                  const t = e.currentTarget
                  t.style.display = 'none'
                }}
              />
            ) : (
              <div
                className="product-img"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  background: '#f8fafc',
                }}
              >
                Sem foto
              </div>
            )}
            <div className="product-body">
              <div style={{ color: '#334155', fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
                {p.shortDescription || 'Disponivel na vitrine'}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginTop: 8 }}>R$ {p.price.toFixed(2)}</div>
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
