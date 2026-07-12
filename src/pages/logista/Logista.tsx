import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { rtdb } from '../../service/firebase'
import { ref, get } from 'firebase/database'

interface Purchase {
  id: string
  name: string
  date: number
  status: string
  totalPieces: number
  costs: {
    freight: number
    travel: number
    consultancy: number
    other: number
  }
  totalCost: number
  uid: string
}

export default function Logista() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPurchases = async () => {
      if (!user) return
      
      try {
        const snapshot = await get(ref(rtdb, 'purchases'))
        if (snapshot.exists()) {
          const data = snapshot.val()
          const purchaseList: Purchase[] = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            /*.filter(p => p.uid === user.uid)*/
            .sort((a, b) => b.date - a.date)
          
          setPurchases(purchaseList)
        }
      } catch (e) {
        console.error('Error loading purchases:', e)
      } finally {
        setLoading(false)
      }
    }

    loadPurchases()
  }, [user])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32 }}>Área do Logista</h1>
          <div style={{ color: '#6b7280', marginTop: 4 }}>Gestão de estoque, preços e pedidos</div>
        </div>
        <Link to="/logista/novo-pedido" style={{
          padding: '12px 20px',
          borderRadius: 12,
          border: 'none',
          background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
          color: '#fff',
          fontWeight: 600,
          textDecoration: 'none'
        }}>
          + Novo Pedido
        </Link>
      </div>

      {/* Pedidos Recentes */}
      <div style={{
        background: '#faf5ff',
        border: '1px solid #e9d5ff',
        borderRadius: 16,
        padding: 24
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: 22 }}>Pedidos Recentes</h2>
        
        {loading && <div style={{ color: '#6b7280' }}>Carregando...</div>}
        
        {!loading && purchases.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
            Nenhum pedido criado ainda. Crie seu primeiro pedido!
          </div>
        )}
        
        {!loading && purchases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {purchases.map((purchase) => {
              const totalLogistics = (purchase.costs?.freight || 0) + 
                                    (purchase.costs?.travel || 0) + 
                                    (purchase.costs?.consultancy || 0) + 
                                    (purchase.costs?.other || 0)
              
              return (
                <div 
                  key={purchase.id}
                  onClick={() => navigate(`/logista/pedido/${purchase.id}`)}
                  style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#c084fc'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{purchase.name}</div>
                    <div style={{ color: '#6b7280', fontSize: 14 }}>
                      {purchase.totalPieces} peças • {new Date(purchase.date).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#8b5cf6', fontSize: 18 }}>
                      R$ {totalLogistics.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: purchase.status === 'completed' ? '#059669' : '#d97706',
                      fontWeight: 600
                    }}>
                      {purchase.status === 'completed' ? 'Concluído' : 'Rascunho'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
