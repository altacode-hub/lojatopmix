import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { get, ref, serverTimestamp, set, update } from 'firebase/database'
import { logistaCardStyle, logistaInputStyle, logistaTheme } from './logistaTheme'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export default function NovoPedido() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { purchaseId } = useParams<{ purchaseId: string }>()
  const isEditing = Boolean(purchaseId && !purchaseId.includes('produtos'))
  const [nome, setNome] = useState('')
  const [qtdPecas, setQtdPecas] = useState<number | ''>('')
  const [custoLogistica, setCustoLogistica] = useState<number | ''>('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(isEditing)

  const custoPorPeca =
    typeof qtdPecas === 'number' && qtdPecas > 0 && typeof custoLogistica === 'number'
      ? Number((custoLogistica / qtdPecas).toFixed(2))
      : 0

  useEffect(() => {
    const loadPurchase = async () => {
      if (!isEditing || !purchaseId) {
        setCarregando(false)
        return
      }
      try {
        const snap = await get(ref(rtdb, `purchases/${purchaseId}`))
        if (snap.exists()) {
          const data = snap.val()
          setNome(data.name || '')
          setQtdPecas(typeof data.totalPieces === 'number' ? data.totalPieces : '')
          const totalCosts =
            (data.costs?.freight || 0) +
            (data.costs?.travel || 0) +
            (data.costs?.consultancy || 0) +
            (data.costs?.other || 0)
          setCustoLogistica(Number(totalCosts) || '')
        }
      } catch (error) {
        console.error('Erro ao carregar pedido:', error)
        setErro(getErrorMessage(error, 'Erro ao carregar dados do pedido.'))
      } finally {
        setCarregando(false)
      }
    }
    loadPurchase()
  }, [isEditing, purchaseId])

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
      if (isEditing && purchaseId) {
        const purchaseRef = ref(rtdb, `purchases/${purchaseId}`)
        const currentSnap = await get(purchaseRef)
        const currentData = currentSnap.exists() ? currentSnap.val() : {}
        const existingCosts = currentData.costs || {}
        const data = {
          name: nome,
          costs: {
            ...existingCosts,
            freight: custoLogistica,
            travel: existingCosts.travel ?? 0,
            consultancy: existingCosts.consultancy ?? 0,
            other: existingCosts.other ?? 0,
          },
          totalPieces: qtdPecas,
          totalCost: custoLogistica,
          updatedAt: Date.now(),
        }
        await update(purchaseRef, data)
        navigate(`/novo-pedido/${purchaseId}/produtos`, { replace: true })
      } else {
        const newPurchaseId = Date.now().toString()
        const purchaseRef = ref(rtdb, `purchases/${newPurchaseId}`)
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
        navigate(`/novo-pedido/${newPurchaseId}/produtos`, { replace: true })
      }
    } catch (error) {
      setErro(getErrorMessage(error, 'Erro ao salvar pedido'))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px', textAlign: 'center', color: logistaTheme.colors.textMuted }}>
        Carregando...
      </div>
    )
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
            background: logistaTheme.colors.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: logistaTheme.colors.accentDark,
            fontSize: 28,
            border: `1px solid ${logistaTheme.colors.accentBorder}`,
          }}
        >
          {isEditing ? '✏️' : '🧾'}
        </div>
        <h1 style={{ margin: 0 }}>{isEditing ? 'Editar Pedido' : 'Novo Pedido'}</h1>
        <div style={{ color: logistaTheme.colors.textMuted, marginTop: 8 }}>
          {isEditing
            ? 'Atualize os dados do pedido. Os custos de logística serão redistribuídos entre as peças.'
            : 'Crie um novo pedido e defina os custos de logística que serão distribuídos entre as peças.'}
        </div>
      </div>

      <div
        style={{
          ...logistaCardStyle,
          background: logistaTheme.colors.accentSoft,
          border: `1px solid ${logistaTheme.colors.accentBorder}`,
          borderRadius: 12,
          padding: 24,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Informações do Pedido</div>
        <div style={{ color: logistaTheme.colors.textMuted, marginBottom: 16 }}>
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
              ...logistaInputStyle,
            }}
          />
          <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted, marginTop: 6 }}>
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
                ...logistaInputStyle,
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
                  color: logistaTheme.colors.textMuted,
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
                  ...logistaInputStyle,
                  padding: '12px 14px 12px 36px',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted, marginTop: 6 }}>
              Inclui frete, viagem, assessoria, etc.
            </div>
          </div>
        </div>

        {typeof qtdPecas === 'number' && qtdPecas > 0 && typeof custoLogistica === 'number' ? (
          <div style={{ marginTop: 8, fontSize: 14, color: logistaTheme.colors.text }}>
            Custo de logística por peça: <strong>R$ {custoPorPeca.toFixed(2)}</strong>
          </div>
        ) : null}

        {erro && (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: logistaTheme.colors.errorBackground,
              border: `1px solid ${logistaTheme.colors.errorBorder}`,
              color: logistaTheme.colors.errorText,
            }}
          >
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <button
            onClick={() => navigate(isEditing && purchaseId ? `/novo-pedido/${purchaseId}/produtos` : '/')}
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              border: `1px solid ${logistaTheme.colors.border}`,
              background: logistaTheme.colors.surface,
              color: logistaTheme.colors.text,
              cursor: 'pointer',
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
              background: logistaTheme.colors.accent,
              color: logistaTheme.colors.surface,
              border: 'none',
              minWidth: 220,
              cursor: salvando ? 'not-allowed' : 'pointer',
              opacity: salvando ? 0.7 : 1,
            }}
          >
            {salvando ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Continuar para Produtos'}
          </button>
        </div>
      </div>
    </div>
  )
}
