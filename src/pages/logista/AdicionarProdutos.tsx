import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { ref, get, set } from 'firebase/database'
import { FiPackage, FiCreditCard, FiTrendingUp, FiBox, FiDollarSign, FiBarChart2, FiCheckCircle, FiTarget, FiTrendingDown, FiPercent, FiEdit, FiTrash2 } from 'react-icons/fi'

interface ProductVariation {
  size: string
  color: string
  quantity: number
}

interface Product {
  id: string
  name: string
  description: string
  supplierName: string
  categoryId: string
  unitCost: number
  packaging: number
  gifts: number
  accessories: number
  sellerCommission: number
  taxes: number
  operational: number
  grossMargin: number
  cardFee: number
  salePrice: number
  priceWithMargin: number
  grossMarginPercentage: number
  totalPieces: number
  variations: ProductVariation[]
}

export default function AdicionarProdutos() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [purchase, setPurchase] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Current form state
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [unitCost, setUnitCost] = useState<number | ''>('')
  const [packaging, setPackaging] = useState<number | ''>('')
  const [gifts, setGifts] = useState<number | ''>('')
  const [accessories, setAccessories] = useState<number | ''>('')
  const [sellerCommission, setSellerCommission] = useState<number | ''>('')
  const [taxes, setTaxes] = useState<number | ''>('')
  const [operational, setOperational] = useState<number | ''>('')
  const [grossMargin, setGrossMargin] = useState<number | ''>('')
  const [cardFee, setCardFee] = useState<number | ''>('')
  const [variations, setVariations] = useState<ProductVariation[]>([])
  const [newVariationSize, setNewVariationSize] = useState('')
  const [newVariationColor, setNewVariationColor] = useState('')
  const [newVariationQuantity, setNewVariationQuantity] = useState<number | ''>('')
  
  // Categories
  const [categories, setCategories] = useState<any[]>([])
  const [sizes] = useState(['34', '36', '38', '40', '42', '44', '46', 'PP', 'P', 'M', 'G', 'GG', 'XG'])
  const [colors] = useState(['Branco', 'Preto', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Rosa', 'Bege', 'Marrom', 'Cinza'])
  
  // Load purchase and categories
  useEffect(() => {
    const loadData = async () => {
      if (!purchaseId) return
      
      try {
        // Load purchase
        const purchaseSnap = await get(ref(rtdb, `purchases/${purchaseId}`))
        if (purchaseSnap.exists()) {
          setPurchase(purchaseSnap.val())
        }
        
        // Load categories
        const categoriesSnap = await get(ref(rtdb, 'categories'))
        if (categoriesSnap.exists()) {
          const cats: any[] = []
          categoriesSnap.forEach((child) => {
            cats.push({ id: child.key, ...child.val() })
          })
          setCategories(cats.sort((a, b) => a.order - b.order))
        }
      } catch (e) {
        console.error('Error loading data:', e)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [purchaseId])
  
  // Calculate total cost per piece from purchase
  const custoPorPeca = purchase && purchase.totalPieces > 0 
    ? Number(((purchase.costs?.freight || 0) + (purchase.costs?.travel || 0) + (purchase.costs?.consultancy || 0) + (purchase.costs?.other || 0)) / purchase.totalPieces).toFixed(2)
    : 0
  
  // Calculate pricing preview values
  const getPricingPreview = () => {
    const uCost = typeof unitCost === 'number' ? unitCost : 0
    const pack = typeof packaging === 'number' ? packaging : 0
    const g = typeof gifts === 'number' ? gifts : 0
    const acc = typeof accessories === 'number' ? accessories : 0
    const logisticsCost = Number(custoPorPeca)
    const sComm = typeof sellerCommission === 'number' ? sellerCommission : 0
    const t = typeof taxes === 'number' ? taxes : 0
    const op = typeof operational === 'number' ? operational : 0
    const gMargin = typeof grossMargin === 'number' ? grossMargin : 0
    const cFee = typeof cardFee === 'number' ? cardFee : 0
    
    // Custos Fixos Totais
    const unitaryCost = uCost
    const totalFixedCost = unitaryCost + logisticsCost
    
    // Margem Bruta (agora em R$)
    const baseCost = uCost + pack + g + acc + logisticsCost
    const marginValue = gMargin
    const priceWithMargin = baseCost + marginValue
    const grossMarginPercentage = baseCost > 0 ? (marginValue / baseCost) * 100 : 0
    
    // Percentuais Operacionais
    const commissionValue = priceWithMargin * (sComm / 100)
    const taxesValue = (priceWithMargin + commissionValue) * (t / 100)
    const operationalValue = (priceWithMargin + commissionValue + taxesValue) * (op / 100)
    const totalOperationalPercentages = commissionValue + taxesValue + operationalValue
    
    // Taxa de Cartão
    const beforeCard = priceWithMargin + totalOperationalPercentages
    const cardFeeValue = beforeCard * (cFee / 100)
    const priceWithCard = beforeCard + cardFeeValue
    
    // Lucro Real
    const netProfit = priceWithMargin - baseCost
    const netMarginPercentage = priceWithMargin > 0 ? (netProfit / priceWithMargin) * 100 : 0
    
    // Projeções (usando 2 peças como exemplo)
    const projectedPieces = 2
    const projectedRevenue = priceWithMargin * projectedPieces
    const projectedProfit = netProfit * projectedPieces
    
    // Rentabilidade
    let profitabilityStatus = ''
    let profitabilityColor = ''
    if (netMarginPercentage >= 40) {
      profitabilityStatus = 'Alta Rentabilidade'
      profitabilityColor = '#059669'
    } else if (netMarginPercentage >= 20) {
      profitabilityStatus = 'Rentabilidade Média'
      profitabilityColor = '#d97706'
    } else {
      profitabilityStatus = 'Baixa Rentabilidade'
      profitabilityColor = '#dc2626'
    }
    
    return {
      unitaryCost,
      logisticsCost,
      totalFixedCost,
      baseCost,
      marginValue,
      priceWithMargin,
      grossMarginPercentage,
      commissionValue,
      taxesValue,
      operationalValue,
      totalOperationalPercentages,
      beforeCard,
      cardFeeValue,
      priceWithCard,
      netProfit,
      netMarginPercentage,
      projectedPieces,
      projectedRevenue,
      projectedProfit,
      profitabilityStatus,
      profitabilityColor,
    }
  }
  
  // Calculate final price
  const calculateSalePrice = () => {
    const preview = getPricingPreview()
    return preview.priceWithCard
  }
  
  const addVariation = () => {
    if (!newVariationSize || typeof newVariationQuantity !== 'number' || newVariationQuantity <= 0) return
    
    const newVar: ProductVariation = {
      size: newVariationSize,
      color: newVariationColor,
      quantity: newVariationQuantity,
    }
    
    setVariations([...variations, newVar])
    setNewVariationSize('')
    setNewVariationColor('')
    setNewVariationQuantity('')
  }
  
  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index))
  }
  
  const addProduct = () => {
    if (!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0) return
    
    // Get pricing preview for this product
    const tempUnitCost = unitCost
    const tempPackaging = typeof packaging === 'number' ? packaging : 0
    const tempGifts = typeof gifts === 'number' ? gifts : 0
    const tempAccessories = typeof accessories === 'number' ? accessories : 0
    const tempLogisticsCost = Number(custoPorPeca)
    const tempGrossMargin = typeof grossMargin === 'number' ? grossMargin : 0
    
    const tempBaseCost = tempUnitCost + tempPackaging + tempGifts + tempAccessories + tempLogisticsCost
    const tempPriceWithMargin = tempBaseCost + tempGrossMargin
    const tempGrossMarginPercentage = tempBaseCost > 0 ? (tempGrossMargin / tempBaseCost) * 100 : 0
    const tempTotalPieces = variations.reduce((sum, v) => sum + v.quantity, 0)
    
    const newProduct: Product = {
      id: Date.now().toString(),
      name: productName,
      description: productDescription,
      supplierName,
      categoryId,
      unitCost,
      packaging: tempPackaging,
      gifts: tempGifts,
      accessories: tempAccessories,
      sellerCommission: typeof sellerCommission === 'number' ? sellerCommission : 0,
      taxes: typeof taxes === 'number' ? taxes : 0,
      operational: typeof operational === 'number' ? operational : 0,
      grossMargin: tempGrossMargin,
      cardFee: typeof cardFee === 'number' ? cardFee : 0,
      salePrice: calculateSalePrice(),
      priceWithMargin: tempPriceWithMargin,
      grossMarginPercentage: tempGrossMarginPercentage,
      totalPieces: tempTotalPieces,
      variations,
    }
    
    setProducts([...products, newProduct])
    
    // Reset form
    setProductName('')
    setProductDescription('')
    setSupplierName('')
    setCategoryId('')
    setUnitCost('')
    setPackaging('')
    setGifts('')
    setAccessories('')
    setSellerCommission('')
    setTaxes('')
    setOperational('')
    setGrossMargin('')
    setCardFee('')
    setVariations([])
  }
  
  const removeProduct = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId))
  }
  
  const finalizePurchase = async () => {
    if (!purchaseId || !user) return
    setSaving(true)
    
    try {
      // Save purchase items
      for (const product of products) {
        const totalQuantity = product.variations.reduce((sum, v) => sum + v.quantity, 0)
        await set(ref(rtdb, `purchaseItems/${purchaseId}/${product.id}`), {
          quantity: totalQuantity,
          cost: product.unitCost,
        })
        
        // Save product
        await set(ref(rtdb, `products/${product.id}`), {
          name: product.name,
          description: product.description,
          supplierName: product.supplierName,
          categoryId: product.categoryId,
          active: true,
          createdAt: Date.now(),
          pricing: {
            unitCost: product.unitCost,
            packaging: product.packaging,
            gifts: product.gifts,
            accessories: product.accessories,
            sellerCommission: product.sellerCommission,
            taxes: product.taxes,
            operational: product.operational,
            grossMargin: product.grossMargin,
            cardFee: product.cardFee,
            salePrice: product.salePrice,
          },
          variations: product.variations.reduce((acc, v) => {
            const key = `${v.size}_${v.color}`
            acc[key] = { ...v, stock: v.quantity }
            return acc
          }, {} as any),
        })
        
        // Save inventory
        const totalStock = product.variations.reduce((sum, v) => sum + v.quantity, 0)
        await set(ref(rtdb, `inventory/${product.id}`), {
          total: totalStock,
          reserved: 0,
          available: totalStock,
        })
        
        // Save showcase
        await set(ref(rtdb, `showcase/${product.id}`), {
          name: product.name,
          price: product.salePrice,
          categoryId: product.categoryId,
          shortDescription: product.description.substring(0, 100),
          available: true,
          stock: totalStock > 0,
          variations: product.variations.reduce((acc, v) => {
            const key = `${v.size}_${v.color}`
            acc[key] = { size: v.size, color: v.color, stock: v.quantity }
            return acc
          }, {} as any),
          featured: false,
          promotion: false,
        })
      }
      
      // Update purchase status
      await set(ref(rtdb, `purchases/${purchaseId}/status`), 'completed')
      
      navigate('/logista')
    } catch (e: any) {
      console.error('Error finalizing purchase:', e)
    } finally {
      setSaving(false)
    }
  }
  
  const totalProducts = products.length
  const totalPieces = products.reduce((sum, p) => sum + p.variations.reduce((s, v) => s + v.quantity, 0), 0)
  const totalRevenue = products.reduce((sum, p) => sum + p.salePrice * p.variations.reduce((s, v) => s + v.quantity, 0), 0)
  const totalCost = products.reduce((sum, p) => sum + p.unitCost * p.variations.reduce((s, v) => s + v.quantity, 0), 0)
  const totalProfit = totalRevenue - totalCost
  
  if (loading) {
    return <div>Carregando...</div>
  }
  
  if (!purchase) {
    return <div>Pedido não encontrado</div>
  }
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 24 }}>
        <div style={{width:'-webkit-fill-available'}}>
          <h1 style={{ margin: 0, fontSize: 28, textAlign: 'left' }}>Adicionar Produto</h1>
          <div style={{ color: '#6b7280', marginTop: 4, textAlign: 'left' }}>
            Pedido: {purchase.name} • Logística: R$ {custoPorPeca}/peça
          </div>
        </div>
        <button
          onClick={finalizePurchase}
          disabled={saving}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            alignSelf: 'flex-start',
            fontSize: '12px',
            width: '200px',
          }}
        >
          {saving ? 'Finalizando...' : 'Finalizar Pedido'}
        </button>
      </div>
      
      {/* Product Form */}
      <div style={{
        background: '#faf5ff',
        border: '1px solid #e9d5ff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <FiPackage /> Informações do Produto
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
              Nome do Produto *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Digite o nome do produto"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
              Fornecedor (opcional)
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="Nome do fornecedor"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
            Descrição (opcional)
          </label>
          <textarea
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
            placeholder="Descreva os detalhes do produto"
            rows={3}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
            Categoria (opcional)
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #e5e7eb',
              background: '#fff',
              boxSizing: 'border-box',
            }}
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>
      {/* Variations */}
      <div style={{
        background: '#faf5ff',
        border: '1px solid #e9d5ff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18 }}>Variações do Produto</h3>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: 14 }}>
            Adicione variações de tamanho e cor (opcional)
          </p>
          
          <div style={{
            border: '1px solid #e9d5ff',
            borderRadius: 16,
            padding: 20,
            background: '#fff',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                  Tamanho
                </label>
                <select
                  value={newVariationSize}
                  onChange={(e) => setNewVariationSize(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Selecione um tamanho</option>
                  {sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                  Cor (opcional)
                </label>
                <select
                  value={newVariationColor}
                  onChange={(e) => setNewVariationColor(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">Selecione uma cor</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                  Quantidade
                </label>
                <input
                  type="number"
                  min={1}
                  value={newVariationQuantity}
                  onChange={(e) => setNewVariationQuantity(e.target.value ? Number(e.target.value) : '')}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              
              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  onClick={addVariation}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    border: '1px solid #e5e7eb',
                    background: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                    width: '100%',
                  }}
                >
                  + Adicionar
                </button>
              </div>
            </div>
            
            {variations.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {variations.map((v, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#f3e8ff',
                    borderRadius: 8,
                    color: '#7c3aed',
                  }}>
                    <span>{v.size} {v.color && `(${v.color})`} - {v.quantity} un</span>
                    <button
                      onClick={() => removeVariation(i)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#7c3aed',
                        cursor: 'pointer',
                        fontSize: 16,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Pricing */}
      <div style={{
        background: '#faf5ff',
        border: '1px solid #e9d5ff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: 18, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
            R$ Precificação
          </h3>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: 14 }}>
            Siga a sequência: custos base → percentuais → margem → taxa final
          </p>
          
          <div style={{
            border: '1px solid #e9d5ff',
            borderRadius: 16,
            padding: 20,
            background: '#fff',
          }}>
            {/* 1. Custos Base */}
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>1. Custos Base</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                    Custo Unitário *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 36px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                    Embalagem
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={packaging}
                      onChange={(e) => setPackaging(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 36px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                    Brindes
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={gifts}
                      onChange={(e) => setGifts(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 36px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                    Aviamentos (etiquetas, cartões...)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 14px 12px 36px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* 2. Percentuais Operacionais */}
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>2. Percentuais Operacionais</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                    Comissão do Vendedor (opcional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={sellerCommission}
                      onChange={(e) => setSellerCommission(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 14px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: 12, color: '#6b7280' }}>%</span>
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600 }}>
                    Impostos ME (opcional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={taxes}
                      onChange={(e) => setTaxes(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 14px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: 12, color: '#6b7280' }}>%</span>
                  </div>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}>
                    Custos Operacionais (opcional)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={operational}
                      onChange={(e) => setOperational(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        padding: '12px 40px 12px 14px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: 12, color: '#6b7280' }}>%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 3. Margem de Lucro Bruta */}
            <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>3. Margem de Lucro Bruta</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}> 
                    Margem Bruta (R$)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: 12, color: '#6b7280' }}>R$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={grossMargin}
                      onChange={(e) => setGrossMargin(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        maxWidth: 250,
                        padding: '12px 14px 12px 36px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#fff',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                <div></div>
              </div>
            </div>
            
            {/* 4. Taxa Final */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#6b7280', textAlign: 'left' }}>4. Taxa Final</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, marginBottom: 6, fontWeight: 600, textAlign: 'left' }}> 
                    <span style={{display:'flex', alignItems:'center', gap:'8px'}}>
                      <FiCreditCard /> Taxa Cartão
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={cardFee}
                      onChange={(e) => setCardFee(e.target.value ? Number(e.target.value) : '')}
                      style={{
                        width: '100%',
                        maxWidth: 250,
                        padding: '12px 40px 12px 14px',
                        borderRadius: 10,
                        border: '1px solid #e5e7eb',
                        background: '#faf5ff',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ position: 'absolute', right: 12, top: 12, color: '#6b7280' }}>%</span>
                  </div>
                </div>
                <div></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Pricing Preview */}
        {typeof unitCost === 'number' && unitCost > 0 && (() => {
          const preview = getPricingPreview()
          return (
            <div style={{
              background: '#fff',
              border: '1px solid #e9d5ff',
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 18, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiBarChart2 /> Preview da Precificação
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Estrutura de Custos e Precificação */}
                <div style={{ fontSize: 14, color: '#6b7280', textAlign: 'left' }}>Estrutura de Custos e Precificação:</div>
                
                {/* Custos Fixos Totais */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 12, fontWeight: 600 }}>
                    <FiBox /> Custos Fixos Totais
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Custo unitário:</span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.unitaryCost.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>+ Logística:</span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.logisticsCost.toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #fbbf24', margin: '8px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#d97706' }}>
                      <span>= Custo Total Unitário:</span>
                      <span>R$ {preview.totalFixedCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Aplicação da Margem */}
                <div style={{
                  background: '#dbeafe',
                  border: '1px solid #3b82f6',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 12, fontWeight: 600 }}>
                    <FiDollarSign /> Aplicação da Margem
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Custo Base Total:</span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.baseCost.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>+ Margem Bruta ({preview.grossMarginPercentage.toFixed(1)}%):</span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.marginValue.toFixed(2)}</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #3b82f6', margin: '8px 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#2563eb' }}>
                      <span>= Preço com Margem:</span>
                      <span>R$ {preview.priceWithMargin.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Percentuais Operacionais */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 12, fontWeight: 600 }}>
                    <FiPercent /> Percentuais Operacionais
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, textAlign: 'left' }}>
                    Aplicados sobre (custo base + margem = R$ {preview.priceWithMargin.toFixed(2)})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#d97706' }}>
                      <span>Total de Percentuais Embutidos:</span>
                      <span>R$ {preview.totalOperationalPercentages.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Taxa de Cartão */}
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #fbbf24',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 12, fontWeight: 600 }}>
                    <FiCreditCard /> Taxa de Cartão
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Preço à vista:</span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.beforeCard.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>+ Taxa cartão ({(typeof cardFee === 'number' ? cardFee : 0).toFixed(1)}%):</span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.cardFeeValue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Lucro Real */}
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 12, fontWeight: 600 }}>
                    <FiCheckCircle /> Lucro Real
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiTrendingDown /> Lucro Líquido por Peça:
                      </span>
                      <span style={{ fontWeight: 600 }}>R$ {preview.netProfit.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#059669' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FiBarChart2 /> Margem Líquida Real:
                      </span>
                      <span>{preview.netMarginPercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Valor de Revenda Ideal */}
                <div style={{
                  background: '#faf5ff',
                  border: '1px solid #a78bfa',
                  borderRadius: 12,
                  padding: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 12, fontWeight: 600, color: '#7c3aed', justifyContent: 'center' }}>
                    <FiTarget /> Valor de Revenda Ideal
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Preço à vista:</span>
                      <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 18 }}>R$ {preview.priceWithMargin.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#6b7280' }}>Preço no cartão:</span>
                      <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 18 }}>R$ {preview.priceWithCard.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Projeções */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div style={{
                    background: '#ecfdf5',
                    border: '1px solid #10b981',
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
                      Projeção de Receita ({preview.projectedPieces} peças)
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>
                      R$ {preview.projectedRevenue.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Receita líquida total</div>
                  </div>
                  
                  <div style={{
                    background: '#fef3c7',
                    border: '1px solid #fbbf24',
                    borderRadius: 12,
                    padding: 16,
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
                      Projeção de Lucro ({preview.projectedPieces} peças)
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>
                      R$ {preview.projectedProfit.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Lucro líquido total</div>
                  </div>
                </div>
                
                {/* Rentabilidade */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 24px',
                    borderRadius: 20,
                    background: `${preview.profitabilityColor}10`,
                    color: preview.profitabilityColor,
                    fontWeight: 700,
                    fontSize: 14,
                    border: `1px solid ${preview.profitabilityColor}`,
                  }}>
                    {preview.profitabilityStatus}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Add Product Button */}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 16, marginBottom: 24 }}>
        <button
          onClick={finalizePurchase}
          disabled={saving}
          style={{
            padding: '12px 20px',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            background: '#fff',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            alignSelf: 'flex-start',
            fontSize: '12px',
            width: '200px',
          }}
        >
          {saving ? 'Finalizando...' : 'Finalizar Pedido'}
        </button>

        <button
          onClick={addProduct}
          disabled={!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: (!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0) ? 'not-allowed' : 'pointer',
            opacity: (!productName.trim() || typeof unitCost !== 'number' || unitCost <= 0 || variations.length === 0) ? 0.7 : 1,
          }}
        >
          + Adicionar Produto
        </button>
      </div>
      
      {/* Added Products List */}
      {products.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontSize: 24, 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FiPackage /> Produtos Adicionados ao Pedido ({products.length})
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {products.map((product) => (
              <div key={product.id} style={{
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: 16,
                padding: 24,
              }}>
                {/* Product Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: 16
                }}>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: 20, 
                    fontWeight: 600 
                  }}>
                    {product.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: 14
                    }}>
                      <FiEdit /> Editar
                    </button>
                    <button
                      onClick={() => removeProduct(product.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #fee2e2',
                        background: '#fff',
                        color: '#dc2626',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 14
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                
                {/* Supplier */}
                {product.supplierName && (
                  <div style={{ 
                    fontSize: 14, 
                    color: '#6b7280', 
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    Fornecedor: {product.supplierName}
                  </div>
                )}
                
                {/* Pricing Info */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: 16, 
                  marginBottom: 16
                }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Preço à vista</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                      R$ {product.priceWithMargin.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Preço no cartão</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>
                      R$ {product.salePrice.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Total de peças</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {product.totalPieces}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Margem</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {product.grossMarginPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                {/* Variations */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Variações:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {product.variations.map((v, i) => (
                      <div key={i} style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: '6px 12px',
                        fontSize: 14
                      }}>
                        {v.size}{v.color ? ` • ${v.color}` : ''} • {v.quantity}x
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Total Revenue */}
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #10b981',
                  borderRadius: 12,
                  padding: 16,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 14, color: '#059669', marginBottom: 4 }}>Receita Total</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>
                    R$ {(product.priceWithMargin * product.totalPieces).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Summary */}
      {products.length > 0 && (
        <div style={{
          background: '#faf5ff',
          border: '1px solid #e9d5ff',
          borderRadius: 16,
          padding: 20,
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiTrendingUp /> Resumo Total do Pedido
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            <div style={{
              background: '#f3e8ff',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{totalProducts}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Produtos</div>
            </div>
            
            <div style={{
              background: '#f3e8ff',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{totalPieces}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Peças Totais</div>
            </div>
            
            <div style={{
              background: '#ecfdf5',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>R$ {totalRevenue.toFixed(2)}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Receita Total</div>
            </div>
            
            <div style={{
              background: '#fef3c7',
              borderRadius: 12,
              padding: 16,
              textAlign: 'center',
              border: '1px solid #fbbf24',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>R$ {totalProfit.toFixed(2)}</div>
              <div style={{ color: '#6b7280', fontSize: 14 }}>Lucro Total</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
