import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { ref, set, serverTimestamp } from 'firebase/database'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export default function NovoPedido() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [qtdPecas, setQtdPecas] = useState<number | ''>('')
  const [custoLogistica, setCustoLogistica] = useState<number | ''>('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const custoPorPeca =
    typeof qtdPecas === 'number' && qtdPecas > 0 && typeof custoLogistica === 'number'
      ? Number((custoLogistica / qtdPecas).toFixed(2))
      : 0

  const salvar = async () => {
    if (!user) {
      setErro('Você precisa estar autenticado.')
      return
    }
    setErro(null)
    if (!nome.trim()) {
      setErro('Informe o nome do pedido.')
      return
    }
    if (typeof qtdPecas !== 'number' || qtdPecas <= 0) {
      setErro('Informe a quantidade total de peças.')
      return
    }
    if (typeof custoLogistica !== 'number' || custoLogistica < 0) {
      setErro('Informe o custo total de logística (pode ser 0).')
      return
    }
    setSalvando(true)
    try {
      const purchaseId = Date.now().toString()
      const purchaseRef = ref(rtdb, `purchases/${purchaseId}`)
      const data = {
        name: nome,
        date: Date.now(),
        costs: {
          freight: custoLogistica,
          travel: 0,
          consultancy: 0,
          other: 0,
        },
        totalPieces: qtdPecas,
        totalCost: custoLogistica,
        status: 'draft',
        createdAt: serverTimestamp(),
        uid: user.uid,
      }
      await set(purchaseRef, data)
      navigate(`/logista/novo-pedido/${purchaseId}/produtos`, { replace: true })
    } catch (error) {
      setErro(getErrorMessage(error, 'Erro ao salvar pedido'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 8px',
            borderRadius: 16,
            background: '#8b5cf6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 28,
          }}
        >
          🧾
        </div>
        <h1 style={{ margin: 0 }}>Novo Pedido</h1>
        <div style={{ color: '#6b7280', marginTop: 8 }}>
          Crie um novo pedido e defina os custos de logística que serão distribuídos entre as peças.
        </div>
      </div>

      <div
        style={{
          background: '#faf5ff',
          border: '1px solid #e9d5ff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Informações do Pedido</div>
        <div style={{ color: '#6b7280', marginBottom: 16 }}>
          Digite as informações básicas do pedido. O sistema calculará automaticamente o custo de logística por peça.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Nome do Pedido *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Pedido Fornecedor ABC - Janeiro 2026"
            style={{
              width: '-webkit-fill-available',
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
          />
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Use um nome descritivo para identificar facilmente este pedido
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Quantidade Total de Peças *</label>
            <input
              type="number"
              min={1}
              value={qtdPecas}
              onChange={(e) => setQtdPecas(e.target.value ? Number(e.target.value) : '')}
              placeholder="Ex: 50"
              style={{
                width: '-webkit-fill-available',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Custo Total de Logística *</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  color: '#6b7280',
                }}
              >
                R$
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={custoLogistica}
                onChange={(e) => setCustoLogistica(e.target.value ? Number(e.target.value) : '')}
                placeholder="0,00"
                style={{
                  width: '-webkit-fill-available',
                  padding: '12px 14px 12px 36px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Inclui frete, viagem, assessoria, etc.
            </div>
          </div>
        </div>

        {typeof qtdPecas === 'number' && qtdPecas > 0 && typeof custoLogistica === 'number' ? (
          <div style={{ marginTop: 8, fontSize: 14, color: '#374151' }}>
            Custo de logística por peça: <strong>R$ {custoPorPeca.toFixed(2)}</strong>
          </div>
        ) : null}

        {erro && <div style={{ color: 'red', marginTop: 12 }}>{erro}</div>}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <button
            onClick={() => navigate('/logista')}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#8b5cf6',
              color: '#fff',
              border: 'none',
              minWidth: 220,
            }}
          >
            {salvando ? 'Salvando...' : 'Continuar para Produtos'}
          </button>
        </div>
      </div>
    </div>
  )
}
