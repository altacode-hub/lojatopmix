import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { ref, get } from 'firebase/database'
import { FiPackage, FiEdit, FiTrash2 } from 'react-icons/fi'

interface ProductVariation {
  size: string
  color: string
  quantity: number
  stock: number
}

interface Product {
  id: string
  name: string
  description: string
  supplierName: string
  categoryId: string
  pricing: {
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
  }
  variations: Record<string, ProductVariation>
  active: boolean
  createdAt: number
}

export default function PedidoDetalhes() {
  const { purchaseId } = useParams<{ purchaseId: string }>()
  useAuth() // We just need to call useAuth for context, even if we don't use the return value
  const navigate = useNavigate()
  
  const [purchase, setPurchase] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const loadData = async () => {
      if (!purchaseId) return
      
      try {
        // Load purchase
        const purchaseSnap = await get(ref(rtdb, `purchases/${purchaseId}`))
        if (purchaseSnap.exists()) {
          setPurchase(purchaseSnap.val())
        }
        
        // Load purchase items and their products
        const itemsSnap = await get(ref(rtdb, `purchaseItems/${purchaseId}`))
        if (itemsSnap.exists()) {
          const itemKeys = Object.keys(itemsSnap.val())
          const productPromises = itemKeys.map(async (productId) => {
            const productSnap = await get(ref(rtdb, `products/${productId}`))
            if (productSnap.exists()) {
              return { id: productId, ...productSnap.val() } as Product
            }
            return null
          })
          const loadedProducts = (await Promise.all(productPromises)).filter(Boolean) as Product[]
          setProducts(loadedProducts)
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
  
  const totalProducts = products.length
  const totalPieces = products.reduce((sum, p) => {
    const variations = Object.values(p.variations || {})
    return sum + variations.reduce((s, v) => s + (v.quantity || 0), 0)
  }, 0)
  const totalRevenue = products.reduce((sum, p) => {
    const variations = Object.values(p.variations || {})
    const qty = variations.reduce((s, v) => s + (v.quantity || 0), 0)
    return sum + (p.pricing?.salePrice || 0) * qty
  }, 0)
  const totalCost = products.reduce((sum, p) => {
    const variations = Object.values(p.variations || {})
    const qty = variations.reduce((s, v) => s + (v.quantity || 0), 0)
    return sum + (p.pricing?.unitCost || 0) * qty
  }, 0)
  const totalProfit = totalRevenue - totalCost
  
  if (loading) {
    return <div style={{ padding: '24px' }}>Carregando...</div>
  }
  
  if (!purchase) {
    return <div style={{ padding: '24px' }}>Pedido não encontrado</div>
  }
  
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <button
            onClick={() => navigate('/logista')}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              cursor: 'pointer',
              marginTop: 4
            }}
          >
            ← Voltar
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: 32 }}>{purchase.name}</h1>
            <div style={{ color: '#6b7280', marginTop: 4 }}>
              Detalhes do pedido e produtos
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#6b7280', fontSize: 14 }}>Status</div>
            <div style={{
              fontWeight: 700,
              fontSize: 16,
              color: purchase.status === 'completed' ? '#059669' : '#d97706'
            }}>
              {purchase.status === 'completed' ? 'Concluído' : 'Rascunho'}
            </div>
          </div>
          {purchase.status === 'completed' && (
            <button
              onClick={() => navigate(`/logista/pedido/${purchaseId}/vitrine`)}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                background: '#fff',
                color: '#111827',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Publicar na vitrine
            </button>
          )}
          <button
            onClick={() => navigate(`/logista/novo-pedido/${purchaseId}/produtos`)}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + Adicionar Produto
          </button>
        </div>
      </div>
      
      {/* Purchase Info */}
      <div style={{
        background: '#faf5ff',
        border: '1px solid #e9d5ff',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
      }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Informações do Pedido</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Total de Peças</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{purchase.totalPieces}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Produtos</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{totalProducts}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Logística Total</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>
              R$ {((purchase.costs?.freight || 0) + (purchase.costs?.travel || 0) + (purchase.costs?.consultancy || 0) + (purchase.costs?.other || 0)).toFixed(2)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Por Peça</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>R$ {custoPorPeca}</div>
          </div>
        </div>
        
        {purchase.date && (
          <div style={{ color: '#6b7280', fontSize: 14, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
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
            gap: '8px'
          }}>
            <FiPackage /> Produtos Adicionados ao Pedido ({products.length})
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {products.map((product) => {
              const variations = Object.values(product.variations || {})
              const totalQty = variations.reduce((sum, v) => sum + (v.quantity || 0), 0)
              
              // Calculate additional fields
              const tempUnitCost = product.pricing?.unitCost || 0
              const tempPackaging = product.pricing?.packaging || 0
              const tempGifts = product.pricing?.gifts || 0
              const tempAccessories = product.pricing?.accessories || 0
              const tempLogisticsCost = Number(custoPorPeca)
              const tempGrossMargin = product.pricing?.grossMargin || 0
              
              const tempBaseCost = tempUnitCost + tempPackaging + tempGifts + tempAccessories + tempLogisticsCost
              const tempPriceWithMargin = tempBaseCost + tempGrossMargin
              
              return (
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
                    {/* We don't have edit/remove functions here, but let's keep the styling */}
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
                      <button style={{
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
                      }}>
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
                        R$ {tempPriceWithMargin.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Preço no cartão</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb' }}>
                        R$ {(product.pricing?.salePrice || 0).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Total de peças</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {totalQty}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>Margem</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        R$ {tempGrossMargin.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Variations */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Variações:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                      {variations.map((v, idx) => (
                        <div key={idx} style={{
                          background: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 14
                        }}>
                          {v.size}{v.color ? ` • ${v.color}` : ''} • {v.quantity || 0}x
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
                      R$ {(tempPriceWithMargin * totalQty).toFixed(2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          
          {/* Summary */}
          <div style={{
            background: '#faf5ff',
            border: '1px solid #e9d5ff',
            borderRadius: 16,
            padding: 24,
            marginTop: 24
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Resumo Total</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              <div style={{
                background: '#f3e8ff',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{totalProducts}</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>Produtos</div>
              </div>
              
              <div style={{
                background: '#f3e8ff',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{totalPieces}</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>Peças Totais</div>
              </div>
              
              <div style={{
                background: '#ecfdf5',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center'
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>R$ {totalRevenue.toFixed(2)}</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>Receita Total</div>
              </div>
              
              <div style={{
                background: '#fef3c7',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center',
                border: '1px solid #fbbf24'
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#d97706' }}>R$ {totalProfit.toFixed(2)}</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>Lucro Total</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {products.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          Nenhum produto adicionado a este pedido.
        </div>
      )}
    </div>
  )
}
