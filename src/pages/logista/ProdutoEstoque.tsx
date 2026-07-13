import { useEffect, useMemo, useState } from 'react'
import { get, ref, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCheckCircle, FiExternalLink, FiImage, FiPackage, FiSave, FiUploadCloud } from 'react-icons/fi'
import { rtdb, storage } from '../../service/firebase'
import type { CatalogVariation, InternalProductRecord, ProductPricing, ShowcaseRecord } from '../../types/catalog'
import { variationLabel } from '../../utils/catalog'

interface CategoryOption {
  id: string
  name: string
}

interface InventoryRecord {
  total: number
  reserved: number
  available: number
}

interface ProductEditorState {
  name: string
  description: string
  shortDescription: string
  supplierName: string
  categoryId: string
  active: boolean
  available: boolean
  featured: boolean
  promotion: boolean
  image: string
  pricing: ProductPricing
  variations: Record<string, CatalogVariation>
  inventory: InventoryRecord
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 20,
  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const buildDefaultPricing = (): ProductPricing => ({
  unitCost: 0,
  allocatedCosts: 0,
  finalUnitCost: 0,
  packaging: 0,
  gifts: 0,
  accessories: 0,
  sellerCommission: 0,
  taxes: 0,
  operational: 0,
  grossMargin: 0,
  cardFee: 0,
  salePrice: 0,
})

const toNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function ProdutoEstoque() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()

  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [product, setProduct] = useState<ProductEditorState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    const loadProduct = async () => {
      if (!productId) {
        setError('Produto nao informado.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const [productSnapshot, showcaseSnapshot, inventorySnapshot, categoriesSnapshot] = await Promise.all([
          get(ref(rtdb, `products/${productId}`)),
          get(ref(rtdb, `showcase/${productId}`)),
          get(ref(rtdb, `inventory/${productId}`)),
          get(ref(rtdb, 'categories')),
        ])

        if (!productSnapshot.exists()) {
          setError('Produto nao encontrado no cadastro interno.')
          setProduct(null)
          return
        }

        const productData = productSnapshot.val() as InternalProductRecord
        const showcaseData = showcaseSnapshot.exists() ? (showcaseSnapshot.val() as ShowcaseRecord) : null
        const inventoryData = inventorySnapshot.exists()
          ? (inventorySnapshot.val() as Partial<InventoryRecord>)
          : null

        if (categoriesSnapshot.exists()) {
          const nextCategories: CategoryOption[] = []
          categoriesSnapshot.forEach((child) => {
            nextCategories.push({
              id: child.key || '',
              name: child.val()?.name || 'Sem nome',
            })
          })
          setCategories(nextCategories.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
        } else {
          setCategories([])
        }

        const pricing = productData.pricing || buildDefaultPricing()
        const unitCost = Number(pricing.unitCost || 0)
        const allocatedCosts = Number(pricing.allocatedCosts || 0)
        const salePrice = Number(showcaseData?.price ?? pricing.salePrice ?? 0)

        setProduct({
          name: showcaseData?.name || productData.name || '',
          description: productData.description || '',
          shortDescription: showcaseData?.shortDescription || productData.description || '',
          supplierName: productData.supplierName || '',
          categoryId: showcaseData?.categoryId || productData.categoryId || '',
          active: Boolean(productData.active ?? true),
          available: Boolean(showcaseData?.available ?? true),
          featured: Boolean(showcaseData?.featured),
          promotion: Boolean(showcaseData?.promotion),
          image: showcaseData?.image || productData.image || '',
          pricing: {
            unitCost,
            allocatedCosts,
            finalUnitCost: Number(pricing.finalUnitCost ?? unitCost + allocatedCosts),
            packaging: Number(pricing.packaging || 0),
            gifts: Number(pricing.gifts || 0),
            accessories: Number(pricing.accessories || 0),
            sellerCommission: Number(pricing.sellerCommission || 0),
            taxes: Number(pricing.taxes || 0),
            operational: Number(pricing.operational || 0),
            grossMargin: Number(pricing.grossMargin || 0),
            cardFee: Number(pricing.cardFee || 0),
            salePrice,
          },
          variations: showcaseData?.variations || productData.variations || {},
          inventory: {
            total: Number(inventoryData?.total || 0),
            reserved: Number(inventoryData?.reserved || 0),
            available: Number(inventoryData?.available || 0),
          },
        })
      } catch (loadError) {
        console.error('Erro ao carregar produto do estoque:', loadError)
        setError('Nao foi possivel carregar os dados do produto.')
      } finally {
        setLoading(false)
      }
    }

    void loadProduct()
  }, [productId])

  const finalUnitCost = useMemo(() => {
    if (!product) return 0
    return Number((product.pricing.unitCost + product.pricing.allocatedCosts).toFixed(2))
  }, [product])

  const marginValue = useMemo(() => {
    if (!product) return 0
    return Number((product.pricing.salePrice - finalUnitCost).toFixed(2))
  }, [finalUnitCost, product])

  const variationEntries = useMemo(() => Object.entries(product?.variations || {}), [product])

  const updateField = <K extends keyof ProductEditorState>(field: K, value: ProductEditorState[K]) => {
    setProduct((current) => (current ? { ...current, [field]: value } : current))
  }

  const updatePricingField = <K extends keyof ProductPricing>(field: K, value: ProductPricing[K]) => {
    setProduct((current) =>
      current
        ? {
            ...current,
            pricing: {
              ...current.pricing,
              [field]: value,
            },
          }
        : current,
    )
  }

  const handleImageUpload = async (file: File | null) => {
    if (!productId || !file) return

    setUploading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const safeName = file.name.replace(/\s+/g, '-').toLowerCase()
      const filePath = `showcase/${productId}/${Date.now()}-${safeName}`
      const imageRef = storageRef(storage, filePath)
      const snapshot = await uploadBytes(imageRef, file)
      const url = await getDownloadURL(snapshot.ref)
      updateField('image', url)
      setSuccessMessage('Imagem enviada. Salve o produto para persistir as alteracoes.')
    } catch (uploadError) {
      console.error('Erro ao enviar imagem do produto:', uploadError)
      setError('Nao foi possivel enviar a imagem para o Firebase Storage.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!productId || !product) return

    const trimmedName = product.name.trim()
    if (!trimmedName) {
      setError('Informe o nome do produto antes de salvar.')
      return
    }

    const trimmedDescription = product.description.trim()
    const trimmedShortDescription = product.shortDescription.trim() || trimmedDescription
    const nextFinalUnitCost = Number((product.pricing.unitCost + product.pricing.allocatedCosts).toFixed(2))
    const hasStock = product.inventory.available > 0 && variationEntries.some(([, variation]) => Number(variation.stock || 0) > 0)
    const now = Date.now()

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await update(ref(rtdb), {
        [`products/${productId}/name`]: trimmedName,
        [`products/${productId}/description`]: trimmedDescription,
        [`products/${productId}/supplierName`]: product.supplierName.trim(),
        [`products/${productId}/categoryId`]: product.categoryId,
        [`products/${productId}/active`]: product.active,
        [`products/${productId}/image`]: product.image || '',
        [`products/${productId}/pricing`]: {
          ...product.pricing,
          finalUnitCost: nextFinalUnitCost,
        },
        [`products/${productId}/variations`]: product.variations,
        [`products/${productId}/updatedAt`]: now,
        [`showcase/${productId}/name`]: trimmedName,
        [`showcase/${productId}/image`]: product.image || '',
        [`showcase/${productId}/price`]: product.pricing.salePrice,
        [`showcase/${productId}/categoryId`]: product.categoryId,
        [`showcase/${productId}/shortDescription`]: trimmedShortDescription,
        [`showcase/${productId}/available`]: product.available,
        [`showcase/${productId}/stock`]: hasStock,
        [`showcase/${productId}/featured`]: product.featured,
        [`showcase/${productId}/promotion`]: product.promotion,
        [`showcase/${productId}/variations`]: product.variations,
        [`showcase/${productId}/updatedAt`]: now,
      })

      setProduct((current) =>
        current
          ? {
              ...current,
              pricing: {
                ...current.pricing,
                finalUnitCost: nextFinalUnitCost,
              },
              shortDescription: trimmedShortDescription,
            }
          : current,
      )
      setSuccessMessage('Produto salvo com sucesso no cadastro interno e na vitrine.')
    } catch (saveError) {
      console.error('Erro ao salvar produto do estoque:', saveError)
      setError('Nao foi possivel salvar as alteracoes do produto.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Carregando produto...</div>
  }

  if (!product) {
    return (
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 16 }}>
        <button
          type="button"
          onClick={() => navigate('/logista/estoque')}
          style={{
            width: 'fit-content',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: 'none',
            background: 'transparent',
            color: '#7c3aed',
            cursor: 'pointer',
            fontWeight: 700,
            padding: 0,
          }}
        >
          <FiArrowLeft size={16} />
          Voltar ao estoque
        </button>
        <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
          {error || 'Produto nao encontrado.'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button
            type="button"
            onClick={() => navigate('/logista/estoque')}
            style={{
              width: 'fit-content',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: 'none',
              background: 'transparent',
              color: '#7c3aed',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0,
              marginBottom: 12,
            }}
          >
            <FiArrowLeft size={16} />
            Voltar ao estoque
          </button>
          <h1 style={{ margin: 0, fontSize: 30 }}>{product.name || 'Editar produto'}</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280', maxWidth: 720 }}>
            Atualize os dados administrativos do produto, a foto e as configuracoes usadas na vitrine e na home.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate(`/produto/${productId}`)}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FiExternalLink size={16} />
            Ver produto publico
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
              color: '#fff',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <FiSave size={16} />
            {saving ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>
      )}

      {successMessage && (
        <div
          style={{
            ...cardStyle,
            borderColor: '#86efac',
            background: '#f0fdf4',
            color: '#166534',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <FiCheckCircle size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        <div style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Preco de venda</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>{currencyFormatter.format(product.pricing.salePrice)}</div>
        </div>
        <div style={{ ...cardStyle, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Custo final por unidade</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>{currencyFormatter.format(finalUnitCost)}</div>
        </div>
        <div style={{ ...cardStyle, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Margem bruta estimada</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>{currencyFormatter.format(marginValue)}</div>
        </div>
        <div style={{ ...cardStyle, background: '#fff7ed', borderColor: '#fed7aa' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Estoque disponivel</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>{product.inventory.available}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 20 }}>
        <div style={{ ...cardStyle, height: 'fit-content' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Foto do produto</div>
          <div
            style={{
              height: 340,
              borderRadius: 16,
              overflow: 'hidden',
              border: '1px solid #e5e7eb',
              background: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {product.image ? (
              <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ color: '#9ca3af', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <FiImage size={36} />
                <span>Sem foto cadastrada</span>
              </div>
            )}
          </div>

          <label
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid #d1d5db',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            <FiUploadCloud size={18} />
            {uploading ? 'Enviando imagem...' : 'Enviar nova imagem'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0] || null
                void handleImageUpload(file)
                event.target.value = ''
              }}
              style={{ display: 'none' }}
            />
          </label>

          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 12 }}>
            A imagem enviada atualiza o cadastro interno e a vitrine apos salvar.
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Dados do produto</div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nome</label>
                <input
                  value={product.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  style={{
                    width: '-webkit-fill-available',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #d1d5db',
                    fontSize: 15,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Categoria</label>
                  <select
                    value={product.categoryId}
                    onChange={(event) => updateField('categoryId', event.target.value)}
                    style={{
                      width: '-webkit-fill-available',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #d1d5db',
                      fontSize: 15,
                      background: '#fff',
                    }}
                  >
                    <option value="">Selecione</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Fornecedor</label>
                  <input
                    value={product.supplierName}
                    onChange={(event) => updateField('supplierName', event.target.value)}
                    style={{
                      width: '-webkit-fill-available',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #d1d5db',
                      fontSize: 15,
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Descricao interna</label>
                <textarea
                  value={product.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  rows={4}
                  style={{
                    width: '-webkit-fill-available',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #d1d5db',
                    fontSize: 15,
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  Descricao curta da vitrine
                </label>
                <textarea
                  value={product.shortDescription}
                  onChange={(event) => updateField('shortDescription', event.target.value)}
                  rows={3}
                  style={{
                    width: '-webkit-fill-available',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #d1d5db',
                    fontSize: 15,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Precificacao</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
              {[
                { key: 'unitCost', label: 'Custo unitario' },
                { key: 'allocatedCosts', label: 'Custos rateados' },
                { key: 'packaging', label: 'Embalagem' },
                { key: 'gifts', label: 'Brindes' },
                { key: 'accessories', label: 'Acessorios' },
                { key: 'sellerCommission', label: 'Comissao vendedora' },
                { key: 'taxes', label: 'Taxas' },
                { key: 'operational', label: 'Operacional' },
                { key: 'grossMargin', label: 'Margem bruta' },
                { key: 'cardFee', label: 'Taxa cartao' },
                { key: 'salePrice', label: 'Preco de venda' },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{field.label}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={product.pricing[field.key as keyof ProductPricing]}
                    onChange={(event) =>
                      updatePricingField(field.key as keyof ProductPricing, toNumber(event.target.value))
                    }
                    style={{
                      width: '-webkit-fill-available',
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid #d1d5db',
                      fontSize: 15,
                    }}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 14,
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Custo final gravado</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{currencyFormatter.format(finalUnitCost)}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Preco atual da vitrine</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{currencyFormatter.format(product.pricing.salePrice)}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Diferenca estimada</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{currencyFormatter.format(marginValue)}</div>
              </div>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Vitrine e home</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                {
                  label: 'Produto ativo no cadastro interno',
                  description: 'Mantem o produto habilitado para operacoes internas.',
                  checked: product.active,
                  onChange: (checked: boolean) => updateField('active', checked),
                },
                {
                  label: 'Aparecer na vitrine para os clientes',
                  description: 'Controla se o item fica disponivel para leitura publica.',
                  checked: product.available,
                  onChange: (checked: boolean) => updateField('available', checked),
                },
                {
                  label: 'Exibir em destaque na home',
                  description: 'Marca o produto como destaque para a tela inicial dos clientes.',
                  checked: product.featured,
                  onChange: (checked: boolean) => updateField('featured', checked),
                },
                {
                  label: 'Sinalizar como promocao',
                  description: 'Mantem a flag de promocao salva na showcase.',
                  checked: product.promotion,
                  onChange: (checked: boolean) => updateField('promotion', checked),
                },
              ].map((item) => (
                <label
                  key={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => item.onChange(event.target.checked)}
                    style={{ marginTop: 4 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600, color: '#111827' }}>{item.label}</span>
                    <span style={{ display: 'block', color: '#6b7280', marginTop: 4 }}>{item.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)', gap: 20 }}>
        <div style={{ ...cardStyle, height: 'fit-content' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Resumo do estoque</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Total em estoque</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{product.inventory.total}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Disponivel</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{product.inventory.available}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Reservado</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{product.inventory.reserved}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>Status automatico da vitrine</div>
              <div style={{ fontWeight: 700 }}>
                {product.inventory.available > 0 ? 'Com estoque para venda' : 'Sem estoque disponivel'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <FiPackage size={18} />
            <div style={{ fontSize: 18, fontWeight: 700 }}>Variacoes cadastradas</div>
          </div>

          {variationEntries.length === 0 ? (
            <div style={{ color: '#6b7280' }}>Nenhuma variacao cadastrada para este produto.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {variationEntries.map(([variationKey, variation]) => (
                <div
                  key={variationKey}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    border: '1px solid #e5e7eb',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{variationLabel(variation)}</div>
                    <div style={{ color: '#6b7280', marginTop: 4 }}>Chave: {variationKey}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Estoque</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{Number(variation.stock || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
