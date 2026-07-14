import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { onValue, ref } from 'firebase/database'
import { useCart } from '../../context/CartContext'
import { rtdb } from '../../service/firebase'
import type { ShowcaseRecord } from '../../types/catalog'
import { getVariationOptions, variationLabel } from '../../utils/catalog'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const [product, setProduct] = useState<(({ id: string } & ShowcaseRecord) | null)>(null)
  const [relatedProducts, setRelatedProducts] = useState<Array<{ id: string } & ShowcaseRecord>>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState(false)

  const [qty, setQty] = useState<number>(1)
  const [variationKey, setVariationKey] = useState<string>('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!id) return

    const showcaseRef = ref(rtdb, 'showcase')
    const unsubscribe = onValue(
      showcaseRef,
      (snapshot) => {
        const showcaseData = snapshot.exists() ? (snapshot.val() as Record<string, ShowcaseRecord>) : {}
        const productData = showcaseData[id] ? ({ id, ...showcaseData[id] } as { id: string } & ShowcaseRecord) : null
        setProduct(productData)

        const allProducts = Object.entries(showcaseData)
          .map(([productId, item]) => ({ id: productId, ...item }))
          .filter((item) => item.id !== id && item.available && getVariationOptions(item.variations).length > 0)
          .slice(0, 3)
        setRelatedProducts(allProducts)
        setLoading(false)
      },
      (error) => {
        console.error('Erro ao carregar produto da vitrine:', error)
        setLoading(false)
      },
    )

    return () => {
      unsubscribe()
    }
  }, [id])

  const variations = useMemo(() => getVariationOptions(product?.variations), [product?.variations])
  const selectedVariation = useMemo(
    () => variations.find((variation) => variation.key === variationKey) || null,
    [variationKey, variations]
  )

  if (loading) {
    return <div>Carregando produto...</div>
  }

  if (!product) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>Produto não encontrado.</div>
        <button onClick={() => navigate(-1)}>Voltar</button>
      </div>
    )
  }

  const canAdd = variationKey && qty > 0 && Boolean(selectedVariation)

  const handleAdd = async () => {
    if (!selectedVariation) return

    const idVariant = `${product.id}:${variationKey}`
    const nameVariant = `${product.name} - ${variationLabel(selectedVariation)}${note ? ' (Obs: ' + note + ')' : ''}`

    try {
      setAddingToCart(true)
      setErrorMessage(null)
      await add({
        id: idVariant,
        productId: product.id,
        variationKey,
        name: nameVariant,
        price: product.price,
        qty,
        note: note.trim() || undefined,
      })
      navigate('/cart')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel reservar o item no carrinho.')
    } finally {
      setAddingToCart(false)
    }
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
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>
              Foto em breve
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
          {product.name}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>R$ {product.price.toFixed(2)}</div>
        <div style={{ color: '#475569', textAlign: 'left' }}>{product.shortDescription || 'Produto disponivel na vitrine.'}</div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ color: '#334155' }}>Qtd:</label>
          <input
            type="number"
            min={1}
            max={selectedVariation?.stock || undefined}
            value={qty}
            onChange={(e) => {
              const nextQty = Math.max(1, Number(e.target.value))
              setQty(selectedVariation ? Math.min(nextQty, selectedVariation.stock) : nextQty)
            }}
            style={{ width: 72, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>

        <div>
          <div style={{ marginBottom: 6, color: '#334155' }}>Tamanho e cor:</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {variations.map((variation) => (
              <label
                key={variation.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  background: variationKey === variation.key ? '#f1f5f9' : '#fff',
                }}
              >
                <input
                  type="radio"
                  name="variation"
                  value={variation.key}
                  checked={variationKey === variation.key}
                  onChange={() => {
                    setVariationKey(variation.key)
                    setQty((currentQty) => Math.min(currentQty, variation.stock))
                  }}
                  style={{ accentColor: '#b58516' }}
                />
                <span>{variationLabel(variation)} • {variation.stock} un</span>
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

        {errorMessage ? (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#fff7ed',
              color: '#9a3412',
              border: '1px solid #fdba74',
            }}
          >
            {errorMessage}
          </div>
        ) : null}

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
            onClick={() => void handleAdd()}
            disabled={addingToCart}
          >
            {addingToCart ? 'Reservando...' : 'Adicionar ao carrinho'}
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
            Selecione uma variacao e quantidade
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
        {relatedProducts.map((p) => (
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
              {p.image ? (
                <img src={p.image} alt={p.name} style={{ width: '100%', height: 96, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', background: '#f8fafc' }}>
                  Sem foto
                </div>
              )}
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ marginTop: 6 }}>R$ {p.price.toFixed(2)}</div>
              </div>
            </Link>
          ))}
      </aside>
    </div>
  )
}
