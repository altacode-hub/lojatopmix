import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { products } from '../../data/products'
import { useCart } from '../../context/CartContext'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const product = useMemo(() => products.find((p) => p.id === id), [id])

  const [mainIndex, setMainIndex] = useState(0)
  const [qty, setQty] = useState<number>(1)
  const [color, setColor] = useState<string>('')
  const [note, setNote] = useState('')

  if (!product) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>Produto não encontrado.</div>
        <button onClick={() => navigate(-1)}>Voltar</button>
      </div>
    )
  }

  const canAdd = color && qty > 0

  const handleAdd = () => {
    const idVariant = `${product.id}:${color}`
    const nameVariant = `${product.name} ${product.code} - ${color}${note ? ' (Obs: ' + note + ')' : ''}`
    add({ id: idVariant, name: nameVariant, price: product.price, qty })
    navigate('/cart')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 2.2fr 1.2fr', gap: 18 }}>
      <div>
        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#fff',
            height: 480,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={product.images[mainIndex]}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {product.images.map((src, i) => (
            <button
              key={src + i}
              onClick={() => setMainIndex(i)}
              style={{
                border: i === mainIndex ? '2px solid #b58516' : '1px solid #e5e7eb',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#fff',
                padding: 0,
                height: 80,
                cursor: 'pointer',
              }}
            >
              <img src={src} alt={`thumb-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
          {product.name} {product.code}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>R$ {product.price.toFixed(2)}</div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ color: '#334155' }}>Qtd:</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            style={{ width: 72, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, color: '#334155' }}>Cor:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {product.colors.map((c) => (
              <label
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  background: color === c ? '#f1f5f9' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name="color"
                  value={c}
                  checked={color === c}
                  onChange={() => setColor(c)}
                  style={{ accentColor: '#b58516' as any }}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Inclua algum detalhe para este produto (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            minHeight: 80,
            resize: 'vertical',
          }}
        />

        {canAdd ? (
          <button
            style={{
              background: '#b58516',
              color: '#fff',
              width: '100%',
              padding: '14px 16px',
              borderRadius: 10,
              fontWeight: 700,
            }}
            onClick={handleAdd}
          >
            Adicionar ao carrinho
          </button>
        ) : (
          <div
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 10,
              background: '#e5e7eb',
              color: '#64748b',
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            Selecione cor e quantidade
          </div>
        )}

        <Link
          to="/"
          style={{
            display: 'inline-block',
            textAlign: 'center',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #b58516',
            color: '#b58516',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Voltar para a loja
        </Link>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>Mais</div>
        {products
          .filter((p) => p.id !== product.id)
          .slice(0, 3)
          .map((p) => (
            <Link
              key={p.id}
              to={`/produto/${p.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr',
                gap: 10,
                textDecoration: 'none',
                color: '#0f172a',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: 96, objectFit: 'cover' }} />
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{p.name} {p.code}</div>
                <div style={{ marginTop: 6 }}>R$ {p.price.toFixed(2)}</div>
              </div>
            </Link>
          ))}
      </aside>
    </div>
  )
}
