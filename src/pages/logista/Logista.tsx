import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { rtdb } from '../../service/firebase'
import { ref, get } from 'firebase/database'
import { logistaCardStyle, logistaTheme } from './logistaTheme'

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
          <div style={{ color: logistaTheme.colors.textMuted, marginTop: 4 }}>
            Gestão de estoque, preços, pedidos e vendas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/logista/vendas"
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.accentBorder}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.accentDark,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Ver Vendas
          </Link>
          <Link
            to="/logista/novo-pedido"
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: logistaTheme.colors.accent,
              color: logistaTheme.colors.surface,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + Novo Pedido
          </Link>
        </div>
      </div>

      {/* Pedidos Recentes */}
      <div
        style={{
          ...logistaCardStyle,
          background: logistaTheme.colors.accentSoft,
          border: `1px solid ${logistaTheme.colors.accentBorder}`,
          padding: 24,
        }}
      >
        <h2 style={{ margin: '0 0 20px 0', fontSize: 22 }}>Pedidos Recentes</h2>
        
        {loading && <div style={{ color: logistaTheme.colors.textMuted }}>Carregando...</div>}
        
        {!loading && purchases.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: logistaTheme.colors.textMuted }}>
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
                    background: logistaTheme.colors.surface,
                    border: `1px solid ${logistaTheme.colors.border}`,
                    borderRadius: 12,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = logistaTheme.colors.accentBorder
                    e.currentTarget.style.boxShadow = logistaTheme.shadow.card
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = logistaTheme.colors.border
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{purchase.name}</div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                      {purchase.totalPieces} peças • {new Date(purchase.date).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: logistaTheme.colors.accentDark, fontSize: 18 }}>
                      R$ {totalLogistics.toFixed(2)}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color:
                        purchase.status === 'completed'
                          ? logistaTheme.colors.successText
                          : logistaTheme.colors.warningText,
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
