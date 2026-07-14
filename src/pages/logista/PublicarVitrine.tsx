import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { get, ref, update } from 'firebase/database'
import { FiCheckCircle, FiExternalLink, FiImage, FiLayers, FiUploadCloud } from 'react-icons/fi'
import { rtdb, storage } from '../../service/firebase'
import type { CatalogVariation, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { getEffectiveVariationStock, hasEffectiveVariationStock, variationLabel } from '../../utils/catalog'
import { CATALOG_SYNC_PATH, patchCachedStockProduct } from './stockCache'

interface ShowcaseEditorProduct {
  id: string
  name: string
  description: string
  categoryId: string
  categoryName: string
  price: number
  image: string
  available: boolean
  featured: boolean
  promotion: boolean
  stock: boolean
  availableStock: number
  shortDescription: string
  variations: Record<string, CatalogVariation>
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
}

export default function PublicarVitrine() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const navigate = useNavigate()

  const [purchaseName, setPurchaseName] = useState('')
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<ShowcaseEditorProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  useEffect(() => {
    const loadProducts = async () => {
      if (!purchaseId) return

      try {
        const [purchaseSnap, itemsSnap, categoriesSnap] = await Promise.all([
          get(ref(rtdb, `purchases/${purchaseId}`)),
          get(ref(rtdb, `purchaseItems/${purchaseId}`)),
          get(ref(rtdb, 'categories')),
        ])
        const categoryMap: Record<string, string> = {}

        if (purchaseSnap.exists()) {
          setPurchaseName(purchaseSnap.val().name || '')
        }

        if (categoriesSnap.exists()) {
          categoriesSnap.forEach((child) => {
            categoryMap[child.key || ''] = child.val()?.name || 'Sem categoria'
          })
          setCategories(categoryMap)
        }

        if (!itemsSnap.exists()) {
          setProducts([])
          return
        }

        const productIds = Object.keys(itemsSnap.val() || {})
        const rows = await Promise.all(
          productIds.map(async (productId) => {
            const [productSnap, showcaseSnap, inventorySnap] = await Promise.all([
              get(ref(rtdb, `products/${productId}`)),
              get(ref(rtdb, `showcase/${productId}`)),
              get(ref(rtdb, `inventory/${productId}`)),
            ])

            if (!productSnap.exists()) return null

            const product = productSnap.val() as InternalProductRecord
            const showcase = showcaseSnap.exists() ? (showcaseSnap.val() as ShowcaseRecord) : null
            const inventory = inventorySnap.exists() ? inventorySnap.val() : null
            const cartReserved = Number(inventory?.cartReserved || 0)

            return {
              id: productId,
              name: showcase?.name || product.name,
              description: product.description || '',
              categoryId: showcase?.categoryId || product.categoryId || '',
              categoryName: categoryMap[showcase?.categoryId || product.categoryId || ''] || 'Sem categoria',
              price: Number(showcase?.price ?? product.pricing?.salePrice ?? 0),
              image: showcase?.image || product.image || '',
              available: Boolean(showcase?.available ?? true),
              featured: Boolean(showcase?.featured),
              promotion: Boolean(showcase?.promotion),
              stock: hasEffectiveVariationStock((showcase?.variations || product.variations || {}) as Record<string, CatalogVariation>),
              availableStock: Math.max(Number(inventory?.available || 0) - cartReserved, 0),
              shortDescription: showcase?.shortDescription || product.description || '',
              variations: showcase?.variations || product.variations || {},
            } satisfies ShowcaseEditorProduct
          })
        )

        setProducts(rows.filter(Boolean) as ShowcaseEditorProduct[])
      } catch (error) {
        console.error('Erro ao carregar produtos da vitrine:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [purchaseId])

  const publishedCount = useMemo(
    () => products.filter((product) => product.available && product.stock).length,
    [products]
  )

  const updateLocalProduct = (productId: string, changes: Partial<ShowcaseEditorProduct>) => {
    setProducts((current) =>
      current.map((product) => (product.id === productId ? { ...product, ...changes } : product))
    )
  }

  const saveShowcaseProduct = async (productId: string, changes: Partial<ShowcaseEditorProduct>) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    const nextProduct = { ...product, ...changes }
    const now = Date.now()
    setSavingId(productId)

    try {
      await update(ref(rtdb), {
        [`showcase/${productId}/name`]: nextProduct.name,
        [`showcase/${productId}/image`]: nextProduct.image || '',
        [`showcase/${productId}/price`]: nextProduct.price,
        [`showcase/${productId}/categoryId`]: nextProduct.categoryId,
        [`showcase/${productId}/shortDescription`]: nextProduct.shortDescription,
        [`showcase/${productId}/available`]: nextProduct.available,
        [`showcase/${productId}/stock`]: nextProduct.stock,
        [`showcase/${productId}/featured`]: nextProduct.featured,
        [`showcase/${productId}/promotion`]: nextProduct.promotion,
        [`showcase/${productId}/updatedAt`]: now,
        [`products/${productId}/image`]: nextProduct.image || '',
        [`products/${productId}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/source`]: 'publicar_vitrine',
      })

      updateLocalProduct(productId, changes)
      patchCachedStockProduct(
        productId,
        {
          name: nextProduct.name,
          image: nextProduct.image || '',
          salePrice: nextProduct.price,
          categoryName: categories[nextProduct.categoryId] || 'Sem categoria',
          available: nextProduct.available,
          featured: nextProduct.featured,
          updatedAt: now,
        },
        now,
      )
    } catch (error) {
      console.error('Erro ao salvar produto da vitrine:', error)
    } finally {
      setSavingId(null)
    }
  }

  const handleImageUpload = async (productId: string, file: File | null) => {
    if (!file) return

    const safeName = file.name.replace(/\s+/g, '-').toLowerCase()
    const filePath = `showcase/${productId}/${Date.now()}-${safeName}`
    setUploadingId(productId)

    try {
      const imageRef = storageRef(storage, filePath)
      const snapshot = await uploadBytes(imageRef, file)
      const url = await getDownloadURL(snapshot.ref)
      await saveShowcaseProduct(productId, { image: url })
    } catch (error) {
      console.error('Erro ao enviar imagem para o Firebase Storage:', error)
    } finally {
      setUploadingId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Carregando etapa de vitrine...</div>
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Produtos publicados na vitrine</h1>
          <div style={{ color: '#6b7280', marginTop: 6 }}>
            Pedido: {purchaseName || purchaseId} • Ajuste imagem e dados que o cliente vai ler na home.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/logista/pedido/${purchaseId}`)}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Voltar ao pedido
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Ver home do cliente
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>1. Pedido de compra</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Concluido</div>
        </div>
        <div style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>2. Cadastro interno</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Produtos gravados</div>
        </div>
        <div style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>3. Estoque</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Indice atualizado</div>
        </div>
        <div style={{ ...cardStyle, background: '#ecfdf5', borderColor: '#10b981' }}>
          <div style={{ color: '#065f46', fontSize: 13 }}>4. Vitrine</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{publishedCount} produto(s) pronto(s)</div>
        </div>
      </div>

      {products.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#6b7280' }}>
          Nenhum produto foi encontrado para publicar na vitrine deste pedido.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {products.map((product) => {
            const variations = Object.values(product.variations || {})

            return (
              <div key={product.id} style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
                  <div>
                    <div
                      style={{
                        height: 260,
                        borderRadius: 16,
                        overflow: 'hidden',
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 12,
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
                          <FiImage size={24} style={{ marginBottom: 8 }} />
                          <div>Envie uma foto para aparecer na home do cliente.</div>
                        </div>
                      )}
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '12px 16px',
                        borderRadius: 12,
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        cursor: uploadingId === product.id ? 'not-allowed' : 'pointer',
                        opacity: uploadingId === product.id ? 0.7 : 1,
                        fontWeight: 600,
                      }}
                    >
                      <FiUploadCloud />
                      {uploadingId === product.id ? 'Enviando foto...' : 'Adicionar foto'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploadingId === product.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null
                          void handleImageUpload(product.id, file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 24 }}>{product.name}</h2>
                        <div style={{ color: '#6b7280', marginTop: 6 }}>
                          Categoria: {product.categoryName || categories[product.categoryId] || 'Sem categoria'} • Preco: R$ {product.price.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ padding: '8px 12px', borderRadius: 999, background: '#fff', border: '1px solid #e5e7eb' }}>
                          Estoque disponivel: {product.availableStock}
                        </div>
                        <div style={{ padding: '8px 12px', borderRadius: 999, background: '#fff', border: '1px solid #e5e7eb' }}>
                          SKU: {product.id}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, textAlign: 'left' }}>
                        Descricao curta da vitrine
                      </label>
                      <textarea
                        value={product.shortDescription}
                        onChange={(event) => updateLocalProduct(product.id, { shortDescription: event.target.value })}
                        rows={3}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid #e5e7eb',
                          resize: 'vertical',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={product.available}
                          onChange={(event) => updateLocalProduct(product.id, { available: event.target.checked })}
                        />
                        Publicado
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={product.featured}
                          onChange={(event) => updateLocalProduct(product.id, { featured: event.target.checked })}
                        />
                        Destaque na home
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={product.promotion}
                          onChange={(event) => updateLocalProduct(product.id, { promotion: event.target.checked })}
                        />
                        Em promocao
                      </label>
                    </div>

                    <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 700 }}>
                        <FiLayers /> Variacoes visiveis para o cliente
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {variations.map((variation, index) => (
                          <div
                            key={`${product.id}-${index}`}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 999,
                              background: '#f8fafc',
                              border: '1px solid #e5e7eb',
                              fontSize: 14,
                            }}
                          >
                            {variationLabel(variation)} • {getEffectiveVariationStock(variation)} un
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ color: '#6b7280', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FiCheckCircle />
                        O cliente le apenas `showcase`, sem acessar custos, margens ou fornecedor.
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => navigate(`/produto/${product.id}`)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1px solid #e5e7eb',
                            background: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <FiExternalLink />
                          Abrir produto
                        </button>
                        <button
                          onClick={() =>
                            void saveShowcaseProduct(product.id, {
                              shortDescription: product.shortDescription,
                              available: product.available,
                              featured: product.featured,
                              promotion: product.promotion,
                              stock: product.availableStock > 0,
                            })
                          }
                          disabled={savingId === product.id}
                          style={{
                            padding: '10px 16px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
                            color: '#fff',
                            cursor: savingId === product.id ? 'not-allowed' : 'pointer',
                            opacity: savingId === product.id ? 0.7 : 1,
                            fontWeight: 700,
                          }}
                        >
                          {savingId === product.id ? 'Salvando...' : 'Salvar vitrine'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
