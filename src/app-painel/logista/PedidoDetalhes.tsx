import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { get, ref } from 'firebase/database'
import { FiEdit, FiImage, FiPackage } from 'react-icons/fi'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import type { CatalogVariation, InternalProductRecord, ProductPricing, ShowcaseRecord } from '../../types/catalog'
import FramedImage from '../../components/FramedImage'
import DeleteProductButton from './components/DeleteProductButton'
import { getProductPricingPreview } from './productPricing'
import { logistaCardStyle, logistaTheme } from './logistaTheme'

interface InventoryRecord {
  total?: number
  reserved?: number
  available?: number
  cartReserved?: number
}

interface Product {
  id: string
  name: string
  description: string
  supplierName: string
  categoryId: string
  image: string
  images: string[]
  mainImageZoom: number
  mainImageOffsetX: number
  mainImageOffsetY: number
  pricing: ProductPricing
  variations: Record<string, CatalogVariation>
  inventory: InventoryRecord
  active: boolean
  createdAt: number
}

interface PurchaseRecord {
  name: string
  date: number
  status: string
  totalPieces: number
  costs?: {
    freight?: number
    travel?: number
    consultancy?: number
    other?: number
  }
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const metricLabelStyle = {
  fontSize: 14,
  color: logistaTheme.colors.textMuted,
  marginBottom: 4,
} as const

const summaryCardBaseStyle = {
  borderRadius: 12,
  padding: 10,
  textAlign: 'center' as const,
} as const

const toNumber = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : 0
}

const hasNumericValue = (value: unknown) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))

const getVariationStock = (variation: CatalogVariation) => toNumber(variation.stock)

const getTotalVariationStock = (variations: CatalogVariation[]) => variations.reduce((sum, variation) => sum + getVariationStock(variation), 0)

const getTotalStock = (inventory: InventoryRecord, variations: CatalogVariation[]) => {
  if (hasNumericValue(inventory.total)) {
    return Math.max(toNumber(inventory.total), 0)
  }

  return getTotalVariationStock(variations)
}

const getAvailableStock = (inventory: InventoryRecord, variations: CatalogVariation[]) => {
  const cartReserved = Math.max(toNumber(inventory.cartReserved), 0)

  if (hasNumericValue(inventory.available)) {
    return Math.max(toNumber(inventory.available) - cartReserved, 0)
  }

  const totalStock = getTotalVariationStock(variations)
  return Math.max(totalStock - toNumber(inventory.reserved) - cartReserved, 0)
}

const buildPricingFormValues = (pricing: ProductPricing) => ({
  unitCost: toNumber(pricing.unitCost),
  packaging: toNumber(pricing.packaging),
  gifts: toNumber(pricing.gifts),
  accessories: toNumber(pricing.accessories),
  sellerCommission: toNumber(pricing.sellerCommission),
  taxes: toNumber(pricing.taxes),
  operational: toNumber(pricing.operational),
  grossMargin: toNumber(pricing.grossMargin),
  cardFee: toNumber(pricing.cardFee),
  finalPrice: toNumber(pricing.finalPrice ?? pricing.salePrice),
  promotionPrice: toNumber(pricing.promotionPrice),
})

export default function PedidoDetalhes() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  useAuth() // We just need to call useAuth for context, even if we don't use the return value
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const [purchase, setPurchase] = useState<PurchaseRecord | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const loadData = async () => {
      if (!purchaseId) {
        setLoading(false)
        return
      }
      
      try {
        const purchaseSnap = await get(ref(rtdb, `purchases/${purchaseId}`))
        if (purchaseSnap.exists()) {
          setPurchase(purchaseSnap.val())
        }
        
        const itemsSnap = await get(ref(rtdb, `purchaseItems/${purchaseId}`))
        if (itemsSnap.exists()) {
          const itemKeys = Object.keys(itemsSnap.val())
          const productPromises = itemKeys.map(async (productId) => {
            const [productSnap, showcaseSnap, inventorySnap] = await Promise.all([
              get(ref(rtdb, `products/${productId}`)),
              get(ref(rtdb, `showcase/${productId}`)),
              get(ref(rtdb, `inventory/${productId}`)),
            ])

            if (productSnap.exists()) {
              const productData = productSnap.val() as InternalProductRecord
              const showcaseData = showcaseSnap.exists() ? (showcaseSnap.val() as ShowcaseRecord) : null
              const inventoryData = inventorySnap.exists() ? (inventorySnap.val() as InventoryRecord) : {}
              const images = Array.from(
                new Set(
                  [showcaseData?.images, productData.images, showcaseData?.image, productData.image]
                    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
                    .filter(Boolean),
                ),
              )

              return {
                id: productId,
                name: showcaseData?.name || productData.name || 'Produto sem nome',
                description: productData.description || showcaseData?.shortDescription || '',
                supplierName: productData.supplierName || '',
                categoryId: showcaseData?.categoryId || productData.categoryId || '',
                image: showcaseData?.image || productData.image || images[0] || '',
                images,
                mainImageZoom: toNumber(showcaseData?.mainImageZoom ?? productData.mainImageZoom ?? 1) || 1,
                mainImageOffsetX: toNumber(showcaseData?.mainImageOffsetX ?? productData.mainImageOffsetX ?? 0),
                mainImageOffsetY: toNumber(showcaseData?.mainImageOffsetY ?? productData.mainImageOffsetY ?? 0),
                pricing: {
                  ...productData.pricing,
                  salePrice: toNumber(productData.pricing?.salePrice ?? showcaseData?.price),
                  finalPrice: toNumber(productData.pricing?.finalPrice ?? productData.pricing?.salePrice ?? showcaseData?.price),
                  promotionPrice: toNumber(productData.pricing?.promotionPrice),
                  realMargin: toNumber(productData.pricing?.realMargin),
                  realMarginPercentage: toNumber(productData.pricing?.realMarginPercentage),
                },
                variations: (showcaseData?.variations || productData.variations || {}) as Record<string, CatalogVariation>,
                inventory: inventoryData,
                active: Boolean(productData.active ?? true),
                createdAt: toNumber(productData.createdAt),
              } satisfies Product
            }
            return null
          })
          const loadedProducts = (await Promise.all(productPromises)).filter(Boolean) as Product[]
          setProducts(loadedProducts)
        } else {
          setProducts([])
        }
      } catch (e) {
        console.error('Error loading data:', e)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [purchaseId])
  
  const custoPorPeca = purchase && purchase.totalPieces > 0 
    ? Number(((purchase.costs?.freight || 0) + (purchase.costs?.travel || 0) + (purchase.costs?.consultancy || 0) + (purchase.costs?.other || 0)) / purchase.totalPieces).toFixed(2)
    : 0
  
  const productCards = useMemo(
    () =>
      products.map((product) => {
        const variations = Object.values(product.variations || {})
        const availableStock = getAvailableStock(product.inventory, variations)
        const totalStock = getTotalStock(product.inventory, variations)
        const pricingPreview = getProductPricingPreview(buildPricingFormValues(product.pricing), Number(custoPorPeca), availableStock)

        return {
          product,
          variations,
          availableStock,
          totalStock,
          pricingPreview,
        }
      }),
    [custoPorPeca, products],
  )

  const totalProducts = productCards.length
  const totalAvailableStock = productCards.reduce((sum, item) => sum + item.availableStock, 0)
  const totalRevenue = productCards.reduce((sum, item) => sum + item.pricingPreview.projectedRevenue, 0)
  const totalProfit = productCards.reduce((sum, item) => sum + item.pricingPreview.projectedProfit, 0)
  
  if (loading) {
    return <div style={{ padding: '24px', color: logistaTheme.colors.textMuted }}>Carregando...</div>
  }
  
  if (!purchase) {
    return <div style={{ padding: '24px', color: logistaTheme.colors.errorText }}>Pedido não encontrado</div>
  }
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? 16 : 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${logistaTheme.colors.border}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 32 }}>{purchase.name}</h1>
            <div style={{ color: logistaTheme.colors.textMuted, marginTop: 4 }}>
              Detalhes do pedido e produtos
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: isMobile ? 'stretch' : 'center', gap: 16, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>Status</div>
            <div style={{
              fontWeight: 700,
              fontSize: 16,
              color:
                purchase.status === 'completed'
                  ? logistaTheme.colors.successText
                  : logistaTheme.colors.warningText,
            }}>
              {purchase.status === 'completed' ? 'Concluído' : 'Rascunho'}
            </div>
          </div>
          {purchase.status === 'completed' && (
            <button
              onClick={() => navigate(`/pedido/${purchaseId}/vitrine`)}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.border}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
                fontWeight: 600,
              cursor: 'pointer',
              }}
            >
              Publicar na vitrine
            </button>
          )}
          <button
            onClick={() => navigate(`/novo-pedido/${purchaseId}/produtos`)}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: logistaTheme.colors.accent,
              color: logistaTheme.colors.surface,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Adicionar Produto
          </button>
        </div>
      </div>
      
      {/* Purchase Info */}
      <div
        style={{
          ...logistaCardStyle,
          background: logistaTheme.colors.accentSoft,
          border: `1px solid ${logistaTheme.colors.accentBorder}`,
          padding: isMobile ? 16 : 24,
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Informações do Pedido</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={metricLabelStyle}>Total de Peças</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{purchase.totalPieces}</div>
          </div>
          <div>
            <div style={metricLabelStyle}>Produtos</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{totalProducts}</div>
          </div>
          <div>
            <div style={metricLabelStyle}>Logística Total</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>
              R$ {((purchase.costs?.freight || 0) + (purchase.costs?.travel || 0) + (purchase.costs?.consultancy || 0) + (purchase.costs?.other || 0)).toFixed(2)}
            </div>
          </div>
          <div>
            <div style={metricLabelStyle}>Por Peça</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>R$ {custoPorPeca}</div>
          </div>
        </div>
        
        {purchase.date && (
          <div
            style={{
              color: logistaTheme.colors.textMuted,
              fontSize: 14,
              borderTop: `1px solid ${logistaTheme.colors.accentBorder}`,
              paddingTop: 12,
            }}
          >
            Criado em {new Date(purchase.date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
      </div>
      
      {/* Products List */}
      {products.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontSize: 24, 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: logistaTheme.colors.text,
          }}>
            <FiPackage /> Produtos Adicionados ao Pedido ({products.length})
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {productCards.map(({ product, variations, availableStock, pricingPreview }) => {
              return (
                <div
                  key={product.id}
                  style={{
                    ...logistaCardStyle,
                    background: logistaTheme.colors.accentSoft,
                    border: `1px solid ${logistaTheme.colors.accentBorder}`,
                    padding: isMobile ? 16 : 24,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '140px 1fr',
                      gap: 16,
                      alignItems: 'start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          width: '100%',
                          height: isMobile ? 180 : 140,
                          borderRadius: 16,
                          overflow: 'hidden',
                          border: `1px solid ${logistaTheme.colors.border}`,
                          background: logistaTheme.colors.surface,
                          position: 'relative',
                        }}
                      >
                        {product.image ? (
                          <FramedImage
                            src={product.image}
                            alt={product.name}
                            zoom={product.mainImageZoom}
                            offsetX={product.mainImageOffsetX}
                            offsetY={product.mainImageOffsetY}
                          />
                        ) : (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'grid',
                              placeItems: 'center',
                              color: logistaTheme.colors.textMuted,
                              textAlign: 'center',
                              padding: 16,
                            }}
                          >
                            <div>
                              <FiImage size={22} style={{ marginBottom: 8 }} />
                              <div>Sem imagem</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginBottom: 16
                      }}>
                        <div>
                          <h3 style={{ 
                            margin: 0, 
                            fontSize: 20, 
                            fontWeight: 600 
                          }}>
                            {product.name}
                          </h3>
                          {product.supplierName && (
                            <div style={{ 
                              fontSize: 14, 
                              color: logistaTheme.colors.textMuted, 
                              marginTop: 6,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              Fornecedor: {product.supplierName}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                        gap: 16, 
                        marginBottom: 16
                      }}>
                        <div>
                          <div style={metricLabelStyle}>Preço com margem</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: logistaTheme.colors.successText }}>
                            {currencyFormatter.format(pricingPreview.priceWithMargin)}
                          </div>
                        </div>
                        <div>
                          <div style={metricLabelStyle}>Preço final</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: logistaTheme.colors.accentDark }}>
                            {currencyFormatter.format(pricingPreview.chosenFinalPrice)}
                          </div>
                        </div>
                        <div>
                          <div style={metricLabelStyle}>Estoque disponível</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {availableStock}
                          </div>
                        </div>
                        <div>
                          <div style={metricLabelStyle}>Margem real</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {currencyFormatter.format(pricingPreview.realMargin)}
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 14, color: logistaTheme.colors.textMuted, marginBottom: 8 }}>Variações:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                          {variations.map((variation, idx) => (
                            <div key={idx} style={{
                              background: logistaTheme.colors.surface,
                              border: `1px solid ${logistaTheme.colors.border}`,
                              borderRadius: 8,
                              padding: '6px 12px',
                              fontSize: 14,
                            }}>
                              {variation.size}
                              {variation.color ? ` • ${variation.color}` : ''}
                              {' • '}
                              {getVariationStock(variation)}x
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div style={{
                        background: logistaTheme.colors.successBackground,
                        border: `1px solid ${logistaTheme.colors.successBorder}`,
                        borderRadius: 12,
                        padding: 16,
                        textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 14, color: logistaTheme.colors.successText, marginBottom: 4 }}>Receita Total</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: logistaTheme.colors.successText }}>
                          {currencyFormatter.format(pricingPreview.projectedRevenue)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap', paddingTop: 16, width: isMobile ? '100%' : 'auto' }}>
                          <DeleteProductButton
                            purchaseId={purchaseId || ''}
                            product={product}
                            products={products}
                            onDeleted={(remainingProducts, remainingTotalPieces) => {
                              setProducts(remainingProducts as Product[])
                              setPurchase((current) => (current ? { ...current, totalPieces: remainingTotalPieces } : current))
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => navigate(`/estoque/${product.id}`)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 10,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              fontSize: 14,
                              width:150,

                              border: 'none',
                              background: logistaTheme.colors.accent,
                              color: logistaTheme.colors.surface,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <FiEdit /> Editar
                          </button>
                        </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Summary */}
          <div
            style={{
              ...logistaCardStyle,
              background: logistaTheme.colors.accentSoft,
              border: `1px solid ${logistaTheme.colors.accentBorder}`,
              padding: isMobile ? 16 : 24,
              marginTop: 24,
            }}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Resumo Total</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140, 1fr)', gap: 16 }}>
              <div style={{
                ...summaryCardBaseStyle,
                background: logistaTheme.colors.surface,
                border: `1px solid ${logistaTheme.colors.accentBorder}`,
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: logistaTheme.colors.accentDark }}>{totalProducts}</div>
                <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>Produtos</div>
              </div>
              
              <div style={{
                ...summaryCardBaseStyle,
                background: logistaTheme.colors.surface,
                border: `1px solid ${logistaTheme.colors.accentBorder}`,
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: logistaTheme.colors.accentDark }}>{totalAvailableStock}</div>
                <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>Estoque Disponível</div>
              </div>
              
              <div style={{
                ...summaryCardBaseStyle,
                background: logistaTheme.colors.successBackground,
                border: `1px solid ${logistaTheme.colors.successBorder}`,
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: logistaTheme.colors.successText }}>
                  {currencyFormatter.format(totalRevenue)}
                </div>
                <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>Receita Total</div>
              </div>
              
              <div style={{
                ...summaryCardBaseStyle,
                background: logistaTheme.colors.warningBackground,
                border: `1px solid ${logistaTheme.colors.warningBorder}`,
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: logistaTheme.colors.warningText }}>
                  {currencyFormatter.format(totalProfit)}
                </div>
                <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>Lucro Pela Margem Real</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: logistaTheme.colors.textMuted }}>
          Nenhum produto adicionado a este pedido.
        </div>
      )}
    </div>
  )
}
