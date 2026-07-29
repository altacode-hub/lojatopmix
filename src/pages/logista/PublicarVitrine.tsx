import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { get, ref, update } from 'firebase/database'
import { FiCheckCircle, FiExternalLink, FiImage, FiLayers } from 'react-icons/fi'
import FramedImage from '../../components/FramedImage'
import { rtdb } from '../../service/firebase'
import type { CatalogVariation, InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { getEffectiveVariationStock, hasEffectiveVariationStock, variationLabel } from '../../utils/catalog'
import { CATALOG_SYNC_PATH, patchCachedStockProduct } from './stockCache'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaCardStyle, logistaInputStyle, logistaTheme } from './logistaTheme'

interface ShowcaseEditorProduct {
  id: string
  name: string
  description: string
  categoryId: string
  categoryName: string
  groupCode: string
  price: number
  image: string
  images: string[]
  mainImageZoom: number
  mainImageOffsetX: number
  mainImageOffsetY: number
  available: boolean
  featured: boolean
  promotion: boolean
  stock: boolean
  availableStock: number
  shortDescription: string
  variations: Record<string, CatalogVariation>
}

type ShowcaseEditableState = Pick<
  ShowcaseEditorProduct,
  'shortDescription' | 'groupCode' | 'available' | 'featured' | 'promotion'
>

const cardStyle: CSSProperties = logistaCardStyle

const stageLabelStyle: CSSProperties = {
  color: logistaTheme.colors.textMuted,
  fontSize: 13,
}

const GROUP_CODE_LENGTH = 5
const GROUP_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const normalizeGroupCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, GROUP_CODE_LENGTH)

const buildRandomGroupCode = () =>
  Array.from({ length: GROUP_CODE_LENGTH }, () => GROUP_CODE_CHARS[Math.floor(Math.random() * GROUP_CODE_CHARS.length)]).join('')

const collectUsedGroupCodes = (items: Array<{ groupCode?: string | null }>) =>
  Array.from(
    new Set(
      items
        .map((item) => normalizeGroupCode(item.groupCode || ''))
        .filter(Boolean),
    ),
  )

const buildEditableState = (product: ShowcaseEditorProduct): ShowcaseEditableState => ({
  shortDescription: product.shortDescription,
  groupCode: normalizeGroupCode(product.groupCode || ''),
  available: Boolean(product.available),
  featured: Boolean(product.featured),
  promotion: Boolean(product.promotion),
})

const isEditableStateEqual = (current: ShowcaseEditableState, saved?: ShowcaseEditableState) => {
  if (!saved) return false

  return (
    current.shortDescription === saved.shortDescription &&
    current.groupCode === saved.groupCode &&
    current.available === saved.available &&
    current.featured === saved.featured &&
    current.promotion === saved.promotion
  )
}

export default function PublicarVitrine() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const [purchaseName, setPurchaseName] = useState('')
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<ShowcaseEditorProduct[]>([])
  const [savedEditableStateById, setSavedEditableStateById] = useState<Record<string, ShowcaseEditableState>>({})
  const [usedGroupCodes, setUsedGroupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  
  useEffect(() => {
    const loadProducts = async () => {
      if (!purchaseId) return

      try {
        const [purchaseSnap, itemsSnap, categoriesSnap, showcaseSnap] = await Promise.all([
          get(ref(rtdb, `purchases/${purchaseId}`)),
          get(ref(rtdb, `purchaseItems/${purchaseId}`)),
          get(ref(rtdb, 'categories')),
          get(ref(rtdb, 'showcase')),
        ])
        const categoryMap: Record<string, string> = {}
        const showcaseMap = showcaseSnap.exists() ? (showcaseSnap.val() as Record<string, ShowcaseRecord>) : {}

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
            const images = Array.from(
              new Set(
                [showcase?.images, product.images, showcase?.image, product.image]
                  .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
                  .filter(Boolean),
              ),
            ) as string[]

            return {
              id: productId,
              name: showcase?.name || product.name,
              description: product.description || '',
              categoryId: showcase?.categoryId || product.categoryId || '',
              categoryName: categoryMap[showcase?.categoryId || product.categoryId || ''] || 'Sem categoria',
              groupCode: normalizeGroupCode(showcase?.groupCode || product.groupCode || ''),
              price: Number(showcase?.price ?? product.pricing?.salePrice ?? 0),
              image: showcase?.image || product.image || images[0] || '',
              images,
              mainImageZoom: Number(showcase?.mainImageZoom ?? product.mainImageZoom ?? 1),
              mainImageOffsetX: Number(showcase?.mainImageOffsetX ?? product.mainImageOffsetX ?? 0),
              mainImageOffsetY: Number(showcase?.mainImageOffsetY ?? product.mainImageOffsetY ?? 0),
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

        const nextProducts = rows.filter(Boolean) as ShowcaseEditorProduct[]
        setProducts(nextProducts)
        setSavedEditableStateById(
          nextProducts.reduce<Record<string, ShowcaseEditableState>>((acc, product) => {
            acc[product.id] = buildEditableState(product)
            return acc
          }, {}),
        )
        setUsedGroupCodes(collectUsedGroupCodes([...Object.values(showcaseMap), ...nextProducts]))
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

  const publishedShowcaseGroups = useMemo(() => {
    const grouped = new Map<string, ShowcaseEditorProduct[]>()

    products
      .filter((product) => product.available && product.stock)
      .forEach((product) => {
        const groupKey = product.groupCode || `__single__${product.id}`
        const current = grouped.get(groupKey) || []
        current.push(product)
        grouped.set(groupKey, current)
      })

    return Array.from(grouped.values())
  }, [products])

  const dirtyProductIds = useMemo(
    () =>
      new Set(
        products
          .filter((product) => !isEditableStateEqual(buildEditableState(product), savedEditableStateById[product.id]))
          .map((product) => product.id),
      ),
    [products, savedEditableStateById],
  )

  const openInNewTab = (path: string) => {
    const url = new URL(path, window.location.origin).toString()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const updateLocalProduct = (productId: string, changes: Partial<ShowcaseEditorProduct>) => {
    setProducts((current) =>
      current.map((product) => (product.id === productId ? { ...product, ...changes } : product))
    )
  }

  const generateUniqueGroupCode = (currentProductId: string) => {
    const currentProduct = products.find((product) => product.id === currentProductId)
    const reservedCodes = new Set(
      usedGroupCodes.filter((code) => code !== normalizeGroupCode(currentProduct?.groupCode || ''))
    )

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = buildRandomGroupCode()
      if (!reservedCodes.has(code)) {
        return code
      }
    }

    return ''
  }

  const handleGenerateGroupCode = (productId: string) => {
    const nextCode = generateUniqueGroupCode(productId)
    if (!nextCode) {
      window.alert('Nao foi possivel gerar um novo codigo agora. Tente novamente.')
      return
    }

    updateLocalProduct(productId, { groupCode: nextCode })
  }

  const saveShowcaseProduct = async (productId: string, changes: Partial<ShowcaseEditorProduct>) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return

    const normalizedGroupCode = normalizeGroupCode(changes.groupCode ?? product.groupCode ?? '')
    const nextProduct = { ...product, ...changes, groupCode: normalizedGroupCode }
    const now = Date.now()
    setSavingId(productId)

    try {
      await update(ref(rtdb), {
        [`showcase/${productId}/name`]: nextProduct.name,
        [`showcase/${productId}/groupCode`]: normalizedGroupCode || null,
        [`showcase/${productId}/image`]: nextProduct.image || '',
        [`showcase/${productId}/mainImageZoom`]: nextProduct.mainImageZoom,
        [`showcase/${productId}/mainImageOffsetX`]: nextProduct.mainImageOffsetX,
        [`showcase/${productId}/mainImageOffsetY`]: nextProduct.mainImageOffsetY,
        [`showcase/${productId}/price`]: nextProduct.price,
        [`showcase/${productId}/categoryId`]: nextProduct.categoryId,
        [`showcase/${productId}/shortDescription`]: nextProduct.shortDescription,
        [`showcase/${productId}/available`]: nextProduct.available,
        [`showcase/${productId}/stock`]: nextProduct.stock,
        [`showcase/${productId}/featured`]: nextProduct.featured,
        [`showcase/${productId}/promotion`]: nextProduct.promotion,
        [`showcase/${productId}/updatedAt`]: now,
        [`products/${productId}/groupCode`]: normalizedGroupCode || null,
        [`products/${productId}/image`]: nextProduct.image || '',
        [`products/${productId}/mainImageZoom`]: nextProduct.mainImageZoom,
        [`products/${productId}/mainImageOffsetX`]: nextProduct.mainImageOffsetX,
        [`products/${productId}/mainImageOffsetY`]: nextProduct.mainImageOffsetY,
        [`products/${productId}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/source`]: 'publicar_vitrine',
      })

      const nextProducts = products.map((item) => (item.id === productId ? nextProduct : item))
      setProducts(nextProducts)
      setSavedEditableStateById((current) => ({
        ...current,
        [productId]: buildEditableState(nextProduct),
      }))
      setUsedGroupCodes(collectUsedGroupCodes(nextProducts))
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

  if (loading) {
    return <div style={{ padding: 24, color: logistaTheme.colors.textMuted }}>Carregando etapa de vitrine...</div>
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 16 : 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Produtos publicados na vitrine</h1>
          <div style={{ color: logistaTheme.colors.textMuted, marginTop: 6 }}>
            Pedido: {purchaseName || purchaseId} • Selecione os produtos que o cliente vai ver na home.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={() => navigate(`/logista/pedido/${purchaseId}`)}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.border}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Voltar ao pedido
          </button>
          <button
            onClick={() => openInNewTab('/')}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: logistaTheme.colors.accent,
              color: logistaTheme.colors.surface,
              cursor: 'pointer',
              fontWeight: 700,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Ver home do cliente
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ ...cardStyle, background: logistaTheme.colors.accentSoft, borderColor: logistaTheme.colors.accentBorder }}>
          <div style={stageLabelStyle}>1. Pedido de compra</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: logistaTheme.colors.accentDark }}>Concluido</div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.accentSoft, borderColor: logistaTheme.colors.accentBorder }}>
          <div style={stageLabelStyle}>2. Cadastro interno</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: logistaTheme.colors.accentDark }}>Produtos gravados</div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.accentSoft, borderColor: logistaTheme.colors.accentBorder }}>
          <div style={stageLabelStyle}>3. Estoque</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: logistaTheme.colors.accentDark }}>Indice atualizado</div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.successBackground, borderColor: logistaTheme.colors.successBorder }}>
          <div style={{ color: logistaTheme.colors.successText, fontSize: 13 }}>4. Vitrine</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: logistaTheme.colors.successText }}>
            {publishedCount} produto(s) pronto(s)
          </div>
        </div>
      </div>

      {publishedShowcaseGroups.length > 0 && (
        <div
          style={{
            ...cardStyle,
            marginBottom: 24,
            background: logistaTheme.colors.surface,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Previa da vitrine</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {publishedShowcaseGroups.map((group, groupIndex) => (
              <div
                key={group[0]?.groupCode || `group-${groupIndex}`}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: 12,
                  borderRadius: 16,
                  background: logistaTheme.colors.surfaceAlt,
                  border: `1px solid ${logistaTheme.colors.border}`,
                }}
              >
                {group.map((product) => {
                  const previewImage = product.images[0] || product.image

                  return (
                    <div
                      key={product.id}
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        overflow: 'hidden',
                        position: 'relative',
                        background: logistaTheme.colors.surface,
                        border: `1px solid ${logistaTheme.colors.border}`,
                      }}
                    >
                      <FramedImage
                        src={previewImage}
                        alt={product.name}
                        zoom={Number(product.mainImageZoom || 1)}
                        offsetX={Number(product.mainImageOffsetX || 0)}
                        offsetY={Number(product.mainImageOffsetY || 0)}
                        fallback={
                          <div style={{ display: 'grid', placeItems: 'center', width: '100%', height: '100%' }}>
                            <FiImage size={18} color={logistaTheme.colors.textMuted} />
                          </div>
                        }
                        fallbackStyle={{
                          position: 'absolute',
                          inset: 0,
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      

      {products.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: logistaTheme.colors.textMuted }}>
          Nenhum produto foi encontrado para publicar na vitrine deste pedido.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {products.map((product) => {
            const variations = Object.values(product.variations || {})
            const hasPendingChanges = dirtyProductIds.has(product.id)

            return (
              <div
                key={product.id}
                style={{
                  ...cardStyle,
                  background: logistaTheme.colors.accentSoft,
                  borderColor: logistaTheme.colors.accentBorder,
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '220px 1fr', gap: 20 }}>
                  <div>
                    <div
                      style={{
                        height: isMobile ? 220 : 260,
                        borderRadius: 16,
                        overflow: 'hidden',
                        border: `1px solid ${logistaTheme.colors.border}`,
                        background: logistaTheme.colors.surface,
                        position: 'relative',
                        marginBottom: 12,
                      }}
                    >
                      {product.image ? (
                        <FramedImage
                          src={product.image}
                          alt={product.name}
                          zoom={Number(product.mainImageZoom || 1)}
                          offsetX={Number(product.mainImageOffsetX || 0)}
                          offsetY={Number(product.mainImageOffsetY || 0)}
                        />
                      ) : (
                        <div
                          style={{
                            color: logistaTheme.colors.textMuted,
                            textAlign: 'center',
                            padding: 16,
                            position: 'absolute',
                            inset: 0,
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <FiImage size={24} style={{ marginBottom: 8 }} />
                          <div>Envie uma foto para aparecer na home do cliente.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 24 }}>{product.name}</h2>
                        <div style={{ color: logistaTheme.colors.textMuted, marginTop: 6 }}>
                          Categoria: {product.categoryName || categories[product.categoryId] || 'Sem categoria'} • Preco: R$ {product.price.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 999,
                            background: logistaTheme.colors.surface,
                            border: `1px solid ${logistaTheme.colors.border}`,
                          }}
                        >
                          Estoque disponivel: {product.availableStock}
                        </div>
                        <div
                          style={{
                            padding: '8px 12px',
                            borderRadius: 999,
                            background: logistaTheme.colors.surface,
                            border: `1px solid ${logistaTheme.colors.border}`,
                          }}
                        >
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
                          ...logistaInputStyle,
                          resize: 'vertical',
                        }}
                      />
                    </div>

                    <div style={{ ...cardStyle, padding: 16, marginBottom: 16 }}>
                      <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, textAlign: 'left' }}>
                        Codigo de agrupamento
                      </label>
                      <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13, marginBottom: 12, textAlign: 'left' }}>
                        Use o mesmo codigo em produtos do mesmo conjunto para o cliente trocar entre cores ou modelos no detalhe.
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 220px) auto', gap: 10 }}>
                        <input
                          type="text"
                          value={product.groupCode}
                          onChange={(event) => updateLocalProduct(product.id, { groupCode: normalizeGroupCode(event.target.value) })}
                          placeholder="Ex.: A1B2C"
                          maxLength={GROUP_CODE_LENGTH}
                          style={{
                            ...logistaInputStyle,
                            width: '100%',
                            boxSizing: 'border-box',
                            textTransform: 'uppercase',
                            letterSpacing: 2,
                            fontWeight: 700,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleGenerateGroupCode(product.id)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            border: `1px solid ${logistaTheme.colors.border}`,
                            background: logistaTheme.colors.surface,
                            color: logistaTheme.colors.text,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          Gerar codigo
                        </button>
                      </div>
                      <div style={{ color: logistaTheme.colors.textMuted, fontSize: 12, marginTop: 8, textAlign: 'left' }}>
                        O codigo deve ter 5 caracteres com letras e numeros.
                      </div>
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
                              background: logistaTheme.colors.surfaceAlt,
                              border: `1px solid ${logistaTheme.colors.border}`,
                              fontSize: 14,
                            }}
                          >
                            {variationLabel(variation)} • {getEffectiveVariationStock(variation)} un
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div
                        style={{
                          color: logistaTheme.colors.textMuted,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <FiCheckCircle />
                        O cliente le apenas `showcase`, sem acessar custos, margens ou fornecedor.
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => openInNewTab(`/produto/${product.id}`)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: `1px solid ${logistaTheme.colors.border}`,
                            background: logistaTheme.colors.surface,
                            color: logistaTheme.colors.text,
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
                              groupCode: product.groupCode,
                              available: product.available,
                              featured: product.featured,
                              promotion: product.promotion,
                              stock: product.availableStock > 0,
                            })
                          }
                          disabled={savingId === product.id || !hasPendingChanges}
                          style={{
                            padding: '10px 16px',
                            borderRadius: 12,
                            border: 'none',
                            background: logistaTheme.colors.accent,
                            color: logistaTheme.colors.surface,
                            cursor: savingId === product.id || !hasPendingChanges ? 'not-allowed' : 'pointer',
                            opacity: savingId === product.id || !hasPendingChanges ? 0.7 : 1,
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
