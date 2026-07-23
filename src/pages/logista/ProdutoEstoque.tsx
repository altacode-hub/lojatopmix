import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { get, ref, update } from 'firebase/database'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { useNavigate, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCheckCircle, FiExternalLink, FiSave } from 'react-icons/fi'
import { rtdb, storage } from '../../service/firebase'
import type { CatalogCategoryRecord, CatalogVariation, InternalProductRecord, ProductPricing, ShowcaseRecord } from '../../types/catalog'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { buildVariationKey } from '../../utils/catalog'
import { buildInventoryProductRow, CATALOG_SYNC_PATH, upsertCachedStockProduct } from './stockCache'
import SharedProductEditorForm, { type ProductCategoryOption, type ProductVariationInput } from './components/SharedProductEditorForm'
import { getProductPricingPreview } from './productPricing'
import { logistaCardStyle, logistaInputStyle, logistaTheme } from './logistaTheme'

interface CategoryOption extends ProductCategoryOption {
  name: string
  image?: string
}

interface InventoryRecord {
  total: number
  reserved: number
  available: number
  cartReserved: number
}

interface ProductEditorState {
  createdAt: number
  purchaseId: string
  name: string
  groupCode: string | null
  description: string
  shortDescription: string
  supplierName: string
  categoryId: string
  active: boolean
  available: boolean
  featured: boolean
  promotion: boolean
  images: string[]
  mainImageZoom: number
  mainImageOffsetX: number
  mainImageOffsetY: number
  pricing: ProductPricing
  variations: ProductVariationInput[]
  inventory: InventoryRecord
}

const cardStyle: CSSProperties = logistaCardStyle

const statLabelStyle: CSSProperties = {
  color: logistaTheme.colors.textMuted,
  fontSize: 12,
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
  finalPrice: 0,
  promotionPrice: 0,
  realMargin: 0,
  realMarginPercentage: 0,
})

const buildEmptyPricingPreviewValues = () => ({
  unitCost: 0,
  packaging: 0,
  gifts: 0,
  accessories: 0,
  sellerCommission: 0,
  taxes: 0,
  operational: 0,
  grossMargin: 0,
  cardFee: 0,
  finalPrice: 0,
  promotionPrice: 0,
})

const mapVariationsToArray = (variations?: Record<string, CatalogVariation>) =>
  Object.values(variations || {}).map((variation) => ({
    size: variation.size,
    color: variation.color,
    quantity: Number(variation.stock || 0),
  }))

const mapVariationsToRecord = (variations: ProductVariationInput[]) =>
  variations.reduce(
    (acc, variation) => {
      acc[buildVariationKey(variation.size, variation.color)] = {
        size: variation.size,
        color: variation.color,
        stock: variation.quantity,
      }
      return acc
    },
    {} as Record<string, CatalogVariation>,
  )

const buildInventoryFromVariations = (variations: ProductVariationInput[], reserved: number, cartReserved = 0) => {
  const total = variations.reduce((sum, variation) => sum + variation.quantity, 0)
  const normalizedReserved = Math.min(reserved, total)
  return {
    total,
    reserved: normalizedReserved,
    available: Math.max(total - normalizedReserved, 0),
    cartReserved: Math.max(cartReserved, 0),
  }
}

export default function ProdutoEstoque() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [product, setProduct] = useState<ProductEditorState | null>(null)
  const [purchase, setPurchase] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [newVariationSize, setNewVariationSize] = useState('')
  const [newVariationColor, setNewVariationColor] = useState('')
  const [newVariationQuantity, setNewVariationQuantity] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const sizes = ['34', '36', '38', '40', '42', '44', '46', 'PP', 'P', 'M', 'G', 'GG', 'XG', 'Único']

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
        const inventoryData = inventorySnapshot.exists() ? (inventorySnapshot.val() as Partial<InventoryRecord>) : null

        if (categoriesSnapshot.exists()) {
          const nextCategories: CategoryOption[] = []
          categoriesSnapshot.forEach((child) => {
            const categoryData = (child.val() || {}) as CatalogCategoryRecord
            nextCategories.push({
              id: child.key || '',
              name: categoryData.name || 'Sem nome',
              image: categoryData.image || '',
            })
          })
          setCategories(nextCategories.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
        } else {
          setCategories([])
        }

        const pricing = productData.pricing || buildDefaultPricing()
        const unitCost = Number(pricing.unitCost || 0)
        const allocatedCosts = Number(pricing.allocatedCosts || 0)
        const finalPrice = Number(pricing.finalPrice ?? showcaseData?.price ?? pricing.salePrice ?? 0)
        const promotionPrice = Number(pricing.promotionPrice ?? showcaseData?.promotionPrice ?? 0)
        
        setPurchase(productData.purchaseId);
        console.log(productData.purchaseId)

        setProduct({
          createdAt: Number(productData.createdAt || Date.now()),
          name: showcaseData?.name || productData.name || '',
          groupCode: productData.groupCode || null,
          purchaseId: productData.purchaseId,
          description: productData.description || '',
          shortDescription: showcaseData?.shortDescription || productData.description || '',
          supplierName: productData.supplierName || '',
          categoryId: showcaseData?.categoryId || productData.categoryId || '',
          active: Boolean(productData.active ?? true),
          available: Boolean(showcaseData?.available ?? true),
          featured: Boolean(showcaseData?.featured),
          promotion: Boolean(showcaseData?.promotion),
          images: showcaseData?.images || productData.images || (showcaseData?.image || productData.image ? [showcaseData?.image || productData.image || ''] : []),
          mainImageZoom: Number(showcaseData?.mainImageZoom ?? productData.mainImageZoom ?? 1),
          mainImageOffsetX: Number(showcaseData?.mainImageOffsetX ?? productData.mainImageOffsetX ?? 0),
          mainImageOffsetY: Number(showcaseData?.mainImageOffsetY ?? productData.mainImageOffsetY ?? 0),
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
            salePrice: finalPrice,
            finalPrice,
            promotionPrice,
            realMargin: Number(pricing.realMargin || 0),
            realMarginPercentage: Number(pricing.realMarginPercentage || 0),
          },
          variations: mapVariationsToArray(showcaseData?.variations || productData.variations),
          inventory: {
            total: Number(inventoryData?.total || 0),
            reserved: Number(inventoryData?.reserved || 0),
            available: Number(inventoryData?.available || 0),
            cartReserved: Number(inventoryData?.cartReserved || 0),
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

  const pricingPreview = useMemo(() => {
    if (!product) return getProductPricingPreview(buildEmptyPricingPreviewValues(), 0)

    return getProductPricingPreview(
      {
        unitCost: product.pricing.unitCost,
        packaging: product.pricing.packaging,
        gifts: product.pricing.gifts,
        accessories: product.pricing.accessories,
        sellerCommission: product.pricing.sellerCommission,
        taxes: product.pricing.taxes,
        operational: product.pricing.operational,
        grossMargin: product.pricing.grossMargin,
        cardFee: product.pricing.cardFee,
        finalPrice: product.pricing.finalPrice ?? product.pricing.salePrice,
        promotionPrice: product.pricing.promotionPrice ?? '',
      },
      Number(product.pricing.allocatedCosts || 0),
      product.inventory.available,
    )
  }, [product])

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

  const replaceVariations = (nextVariations: ProductVariationInput[]) => {
    setProduct((current) => {
      if (!current) return current
      return {
        ...current,
        variations: nextVariations,
        inventory: buildInventoryFromVariations(nextVariations, current.inventory.reserved, current.inventory.cartReserved),
      }
    })
  }

  const addVariation = () => {
    if (!newVariationSize || typeof newVariationQuantity !== 'number' || newVariationQuantity <= 0) return

    replaceVariations([
      ...(product?.variations || []),
      {
        size: newVariationSize,
        color: newVariationColor,
        quantity: newVariationQuantity,
      },
    ])
    setNewVariationSize('')
    setNewVariationColor('')
    setNewVariationQuantity('')
  }

  const removeVariation = (index: number) => {
    replaceVariations((product?.variations || []).filter((_, variationIndex) => variationIndex !== index))
  }

  const handleImageUpload = async (files: File[]) => {
    if (!productId || files.length === 0) return

    setUploadingImages(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file) => {
          const safeName = file.name.replace(/\s+/g, '-').toLowerCase()
          const filePath = `showcase/${productId}/${Date.now()}-${safeName}`
          const imageRef = storageRef(storage, filePath)
          const snapshot = await uploadBytes(imageRef, file)
          return getDownloadURL(snapshot.ref)
        }),
      )

      setProduct((current) => (current ? { ...current, images: [...current.images, ...uploadedUrls] } : current))
      setSuccessMessage('Imagens enviadas. Salve o produto para persistir as alteracoes.')
    } catch (uploadError) {
      console.error('Erro ao enviar imagens do produto:', uploadError)
      setError('Nao foi possivel enviar as imagens para o Firebase Storage.')
    } finally {
      setUploadingImages(false)
    }
  }

  const removeImage = (index: number) => {
    setProduct((current) =>
      current
        ? {
            ...current,
            images: current.images.filter((_, imageIndex) => imageIndex !== index),
            ...(index === 0
              ? {
                  mainImageZoom: 1,
                  mainImageOffsetX: 0,
                  mainImageOffsetY: 0,
                }
              : {}),
          }
        : current,
    )
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
    const nextVariations = mapVariationsToRecord(product.variations)
    const nextInventory = buildInventoryFromVariations(product.variations, product.inventory.reserved, product.inventory.cartReserved)
    const now = Date.now()
    const categoryMap = categories.reduce(
      (acc, category) => {
        acc[category.id] = category.name
        return acc
      },
      {} as Record<string, string>,
    )
    const nextProductRecord: InternalProductRecord = {
      name: trimmedName,
      description: trimmedDescription,
      supplierName: product.supplierName.trim(),
      groupCode: product.groupCode || null,
      purchaseId: product.purchaseId,
      categoryId: product.categoryId,
      active: product.active,
      createdAt: product.createdAt,
      updatedAt: now,
      image: product.images[0] || '',
      images: product.images,
      mainImageZoom: product.mainImageZoom,
      mainImageOffsetX: product.mainImageOffsetX,
      mainImageOffsetY: product.mainImageOffsetY,
      pricing: {
        ...product.pricing,
        finalUnitCost: nextFinalUnitCost,
        salePrice: pricingPreview.chosenFinalPrice,
        finalPrice: pricingPreview.chosenFinalPrice,
        promotionPrice: pricingPreview.chosenPromotionPrice,
        realMargin: pricingPreview.realMargin,
        realMarginPercentage: pricingPreview.realMarginPercentage,
      },
      variations: nextVariations,
    }
    const nextShowcaseRecord: ShowcaseRecord = {
      purchaseId: product.purchaseId,
      name: trimmedName,
      groupCode: product.groupCode || null,
      image: product.images[0] || '',
      images: product.images,
      mainImageZoom: product.mainImageZoom,
      mainImageOffsetX: product.mainImageOffsetX,
      mainImageOffsetY: product.mainImageOffsetY,
      price: pricingPreview.chosenFinalPrice,
      promotionPrice: pricingPreview.chosenPromotionPrice || undefined,
      categoryId: product.categoryId,
      shortDescription: trimmedShortDescription,
      available: product.available,
      stock: nextInventory.available > 0,
      variations: nextVariations,
      featured: product.featured,
      promotion: product.promotion,
      updatedAt: now,
    }

    setSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await update(ref(rtdb), {
        [`products/${productId}`]: nextProductRecord,
        [`showcase/${productId}`]: nextShowcaseRecord,
        [`inventory/${productId}`]: nextInventory,
        [`${CATALOG_SYNC_PATH}/updatedAt`]: now,
        [`${CATALOG_SYNC_PATH}/source`]: 'produto_estoque',
      })

      const cachedRow = buildInventoryProductRow(productId, nextProductRecord, nextShowcaseRecord, nextInventory, categoryMap)
      upsertCachedStockProduct(cachedRow, now)

      setProduct((current) =>
        current
          ? {
              ...current,
              shortDescription: trimmedShortDescription,
              pricing: {
                ...current.pricing,
                finalUnitCost: nextFinalUnitCost,
                salePrice: pricingPreview.chosenFinalPrice,
                finalPrice: pricingPreview.chosenFinalPrice,
                promotionPrice: pricingPreview.chosenPromotionPrice,
                realMargin: pricingPreview.realMargin,
                realMarginPercentage: pricingPreview.realMarginPercentage,
              },
              groupCode: product.groupCode || null,
              inventory: nextInventory,
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
    return <div style={{ padding: 24, color: logistaTheme.colors.textMuted }}>Carregando produto...</div>
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
            color: logistaTheme.colors.accentDark,
            cursor: 'pointer',
            fontWeight: 700,
            padding: 0,
          }}
        >
          <FiArrowLeft size={16} />
          Voltar ao estoque
        </button>
        <div
          style={{
            ...cardStyle,
            borderColor: logistaTheme.colors.errorBorder,
            background: logistaTheme.colors.errorBackground,
            color: logistaTheme.colors.errorText,
          }}
        >
          {error || 'Produto nao encontrado.'}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
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
              color: logistaTheme.colors.accentDark,
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
          <p style={{ margin: '8px 0 0', color: logistaTheme.colors.textMuted, maxWidth: 720 }}>
            A edição usa o mesmo formulário do lançamento do produto, com múltiplas imagens, preços e margem real.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => navigate(`/produto/${productId}`)}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.border}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <FiExternalLink size={16} />
            Ver produto publico
          </button>
          <button
            disabled={!purchase}
            type="button"
            onClick={() => navigate(`/logista/pedido/${purchase}`)}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.border}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'center',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <FiExternalLink size={16} />
            Ver pedido
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: logistaTheme.colors.accent,
              color: logistaTheme.colors.surface,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 700,
              opacity: saving ? 0.7 : 1,
              justifyContent: 'center',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            <FiSave size={16} />
            {saving ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            ...cardStyle,
            borderColor: logistaTheme.colors.errorBorder,
            background: logistaTheme.colors.errorBackground,
            color: logistaTheme.colors.errorText,
          }}
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          style={{
            ...cardStyle,
            borderColor: logistaTheme.colors.successBorder,
            background: logistaTheme.colors.successBackground,
            color: logistaTheme.colors.successText,
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
        <div style={{ ...cardStyle, background: logistaTheme.colors.accentSoft, borderColor: logistaTheme.colors.accentBorder }}>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Preço final</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.accentDark }}>
            {currencyFormatter.format(pricingPreview.chosenFinalPrice)}
          </div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.surfaceAlt, borderColor: logistaTheme.colors.borderStrong }}>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Preço promoção</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.accentDark }}>
            {currencyFormatter.format(pricingPreview.chosenPromotionPrice || 0)}
          </div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.successBackground, borderColor: logistaTheme.colors.successBorder }}>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Margem real</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.successText }}>
            {currencyFormatter.format(pricingPreview.realMargin)}
          </div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.warningBackground, borderColor: logistaTheme.colors.warningBorder }}>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Estoque disponivel</div>
          <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.warningText }}>
            {product.inventory.available}
          </div>
        </div>
      </div>

      <SharedProductEditorForm
        categories={categories}
        sizes={sizes}
        productName={product.name}
        groupCode={product.groupCode || null}
        onProductNameChange={(value) => updateField('name', value)}
        supplierName={product.supplierName}
        onSupplierNameChange={(value) => updateField('supplierName', value)}
        productDescription={product.description}
        onProductDescriptionChange={(value) => updateField('description', value)}
        categoryId={product.categoryId}
        onCategoryIdChange={(value) => updateField('categoryId', value)}
        images={product.images}
        mainImageZoom={product.mainImageZoom}
        onMainImageZoomChange={(value) => updateField('mainImageZoom', value)}
        mainImageOffsetX={product.mainImageOffsetX}
        onMainImageOffsetXChange={(value) => updateField('mainImageOffsetX', value)}
        mainImageOffsetY={product.mainImageOffsetY}
        onMainImageOffsetYChange={(value) => updateField('mainImageOffsetY', value)}
        uploadingImages={uploadingImages}
        onUploadImages={(files) => void handleImageUpload(files)}
        onRemoveImage={removeImage}
        newVariationSize={newVariationSize}
        onNewVariationSizeChange={setNewVariationSize}
        newVariationColor={newVariationColor}
        onNewVariationColorChange={setNewVariationColor}
        newVariationQuantity={newVariationQuantity}
        onNewVariationQuantityChange={setNewVariationQuantity}
        variations={product.variations}
        onAddVariation={addVariation}
        onRemoveVariation={removeVariation}
        unitCost={product.pricing.unitCost}
        onUnitCostChange={(value) => updatePricingField('unitCost', Number(value || 0))}
        packaging={product.pricing.packaging}
        onPackagingChange={(value) => updatePricingField('packaging', Number(value || 0))}
        gifts={product.pricing.gifts}
        onGiftsChange={(value) => updatePricingField('gifts', Number(value || 0))}
        accessories={product.pricing.accessories}
        onAccessoriesChange={(value) => updatePricingField('accessories', Number(value || 0))}
        sellerCommission={product.pricing.sellerCommission}
        onSellerCommissionChange={(value) => updatePricingField('sellerCommission', Number(value || 0))}
        taxes={product.pricing.taxes}
        onTaxesChange={(value) => updatePricingField('taxes', Number(value || 0))}
        operational={product.pricing.operational}
        onOperationalChange={(value) => updatePricingField('operational', Number(value || 0))}
        grossMargin={product.pricing.grossMargin}
        onGrossMarginChange={(value) => updatePricingField('grossMargin', Number(value || 0))}
        cardFee={product.pricing.cardFee}
        onCardFeeChange={(value) => updatePricingField('cardFee', Number(value || 0))}
        finalPrice={product.pricing.finalPrice ?? product.pricing.salePrice}
        onFinalPriceChange={(value) => {
          const nextValue = Number(value || 0)
          updatePricingField('finalPrice', nextValue)
          updatePricingField('salePrice', nextValue)
        }}
        promotionPrice={product.pricing.promotionPrice ?? 0}
        onPromotionPriceChange={(value) => updatePricingField('promotionPrice', Number(value || 0))}
        pricingPreview={pricingPreview}
        onSave={handleSave}
        saveButtonLabel={saving ? 'Salvando...' : 'Salvar produto'}
        saveButtonDisabled={saving}
        onManageCategories={() => navigate('/logista/categorias')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Complemento da vitrine</div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Descrição curta da vitrine</label>
              <textarea
                value={product.shortDescription}
                onChange={(event) => updateField('shortDescription', event.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  ...logistaInputStyle,
                  fontSize: 15,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>
              O preço final alimenta a vitrine. O preço promoção fica salvo para uso em campanhas e badges promocionais.
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
                  border: `1px solid ${logistaTheme.colors.border}`,
                  cursor: 'pointer',
                  background: logistaTheme.colors.surface,
                }}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(event) => item.onChange(event.target.checked)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <span style={{ display: 'block', fontWeight: 600, color: logistaTheme.colors.text }}>{item.label}</span>
                  <span style={{ display: 'block', color: logistaTheme.colors.textMuted, marginTop: 4 }}>{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Resumo do estoque</div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <div style={statLabelStyle}>Total em estoque</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{product.inventory.total}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Disponivel</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{product.inventory.available}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Reservado</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{product.inventory.reserved}</div>
            </div>
            <div>
              <div style={statLabelStyle}>Status automatico da vitrine</div>
              <div style={{ fontWeight: 700 }}>
                {product.inventory.available > 0 ? 'Com estoque para venda' : 'Sem estoque disponivel'}
              </div>
            </div>
            <div>
              <div style={statLabelStyle}>Custo rateado da compra</div>
              <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.pricing.allocatedCosts || 0)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
