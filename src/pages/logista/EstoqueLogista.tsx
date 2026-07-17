import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, onValue, ref } from 'firebase/database'
import { useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiBox, FiChevronRight, FiDatabase, FiEye, FiPackage, FiRefreshCw, FiSearch, FiStar } from 'react-icons/fi'
import FramedImage from '../../components/FramedImage'
import { rtdb } from '../../service/firebase'
import type { InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import {
  buildInventoryRows,
  CATALOG_SYNC_PATH,
  type InventoryProductRow,
  type InventoryRecord,
  normalizeText,
  readStockCache,
  writeStockCache,
} from './stockCache'

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

type CacheSource = 'local' | 'online'

const formatDateTime = (value: number | null) => {
  if (!value) return 'Nao sincronizado'
  return new Date(value).toLocaleString('pt-BR')
}

export default function EstoqueLogista() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<InventoryProductRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cacheSource, setCacheSource] = useState<CacheSource | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<number | null>(null)
  const [localUpdatedAt, setLocalUpdatedAt] = useState<number | null>(null)
  const [isOutdated, setIsOutdated] = useState(false)
  const lastObservedRemoteSyncRef = useRef(0)

  const applyCacheToState = useCallback((cache: ReturnType<typeof readStockCache>) => {
    if (!cache) return
    setProducts(cache.rows)
    setCacheSource('local')
    setLastSyncedAt(cache.syncedAt || null)
    setLocalUpdatedAt(cache.remoteUpdatedAt || null)
  }, [])

  const fetchRemoteUpdatedAt = useCallback(async () => {
    const snapshot = await get(ref(rtdb, `${CATALOG_SYNC_PATH}/updatedAt`))
    return Number(snapshot.val() || 0)
  }, [])

  const syncWithOnlineDatabase = useCallback(async () => {
    try {
      setSyncing(true)
      setLoading((current) => current && products.length === 0)
      setError(null)

      const [productsSnapshot, showcaseSnapshot, inventorySnapshot, categoriesSnapshot, remoteTimestamp] = await Promise.all([
        get(ref(rtdb, 'products')),
        get(ref(rtdb, 'showcase')),
        get(ref(rtdb, 'inventory')),
        get(ref(rtdb, 'categories')),
        fetchRemoteUpdatedAt(),
      ])

      const productsData = (productsSnapshot.exists() ? productsSnapshot.val() : {}) as Record<
        string,
        InternalProductRecord
      >
      const showcaseData = (showcaseSnapshot.exists() ? showcaseSnapshot.val() : {}) as Record<string, ShowcaseRecord>
      const inventoryData = (inventorySnapshot.exists() ? inventorySnapshot.val() : {}) as Record<string, InventoryRecord>
      const categoriesRaw = (categoriesSnapshot.exists() ? categoriesSnapshot.val() : {}) as Record<string, { name?: string }>
      const categoriesMap = Object.entries(categoriesRaw).reduce(
        (acc, [categoryId, category]) => {
          acc[categoryId] = category?.name || 'Sem categoria'
          return acc
        },
        {} as Record<string, string>,
      )

      const nextRows = buildInventoryRows(productsData, showcaseData, inventoryData, categoriesMap)
      const nextRemoteUpdatedAt =
        remoteTimestamp || nextRows.reduce((maxTimestamp, row) => Math.max(maxTimestamp, Number(row.updatedAt || 0)), 0)
      const syncedAt = Date.now()

      writeStockCache({
        syncedAt,
        remoteUpdatedAt: nextRemoteUpdatedAt,
        rows: nextRows,
      })

      setProducts(nextRows)
      setCacheSource('online')
      setLastSyncedAt(syncedAt)
      setLocalUpdatedAt(nextRemoteUpdatedAt || null)
      setRemoteUpdatedAt(nextRemoteUpdatedAt || null)
      setIsOutdated(false)
    } catch (loadError) {
      console.error('Erro ao sincronizar estoque do logista:', loadError)
      setError('Nao foi possivel sincronizar o estoque com o Firebase.')
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [fetchRemoteUpdatedAt, products.length])

  const checkLocalCacheStatus = useCallback(async () => {
    try {
      const cache = readStockCache()

      if (cache) {
        applyCacheToState(cache)
        setLoading(false)
      }

      const nextRemoteUpdatedAt = await fetchRemoteUpdatedAt()
      setRemoteUpdatedAt(nextRemoteUpdatedAt || null)

      if (!cache) {
        await syncWithOnlineDatabase()
        return
      }

      const stale = nextRemoteUpdatedAt > Number(cache.remoteUpdatedAt || 0)
      setIsOutdated(stale)
      setCacheSource('local')
    } catch (statusError) {
      console.error('Erro ao verificar status do cache local:', statusError)

      const cache = readStockCache()
      if (cache) {
        applyCacheToState(cache)
        setLoading(false)
      } else {
        setError('Nao foi possivel carregar o banco local nem verificar o Firebase.')
        setLoading(false)
      }
    }
  }, [applyCacheToState, fetchRemoteUpdatedAt, syncWithOnlineDatabase])

  useEffect(() => {
    void checkLocalCacheStatus()
  }, [checkLocalCacheStatus])

  useEffect(() => {
    const syncRef = ref(rtdb, `${CATALOG_SYNC_PATH}/updatedAt`)
    const unsubscribe = onValue(syncRef, (snapshot) => {
      const nextRemoteVersion = Number(snapshot.val() || 0)
      setRemoteUpdatedAt(nextRemoteVersion || null)

      if (!nextRemoteVersion || nextRemoteVersion === lastObservedRemoteSyncRef.current) {
        return
      }

      lastObservedRemoteSyncRef.current = nextRemoteVersion
      void syncWithOnlineDatabase()
    })

    return () => unsubscribe()
  }, [syncWithOnlineDatabase])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim())

    if (!normalizedSearch) {
      return products
    }

    return products.filter((product) => product.searchText.includes(normalizedSearch))
  }, [products, search])

  const stats = useMemo(
    () => ({
      totalProducts: products.length,
      activeInShowcase: products.filter((product) => product.available && product.active).length,
      featuredProducts: products.filter((product) => product.featured).length,
      totalAvailableStock: products.reduce((sum, product) => sum + product.availableStock, 0),
    }),
    [products],
  )

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30 }}>Estoque da loja</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280', maxWidth: 720 }}>
            Consulte primeiro o banco local para economizar leituras do Firebase, sincronize quando desejar e acompanhe
            se o cache esta atualizado em relacao ao banco online.
          </p>
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          marginBottom: 20,
          borderColor: isOutdated ? '#facc15' : '#d1fae5',
          background: isOutdated ? '#fffbeb' : '#f0fdf4',
        }}
      >
        <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 700, color: isOutdated ? '#854d0e' : '#166534' }}>
                {isOutdated ? <FiAlertCircle size={20} color="#a16207" /> : <FiDatabase size={20} color="#166534" />}
            
                <span style={{ marginLeft: 8 }}>{`${isOutdated ? 'Banco local desatualizado' : 'Banco local sincronizado'}`}</span>
              </div>
              <div style={{ color: isOutdated ? '#854d0e' : '#166534', marginTop: 4 }}>
                Fonte atual: {cacheSource === 'online' ? 'sincronizacao online mais recente' : 'cache local'}.
              </div>
            </div>
            <div style={{ display: 'grid', justifyContent: 'center', justifyItems: 'center' }}>
              <div style={{ color: '#4b5563', fontSize: 14  }}>
                Ultima sincronizacao local: {formatDateTime(lastSyncedAt)}
              </div>
              <button
                type="button"
                onClick={() => void syncWithOnlineDatabase()}
                disabled={syncing}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
                  color: '#fff',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 700,
                  opacity: syncing ? 0.7 : 1,
                }}
              >
                <FiRefreshCw size={16} />
                {syncing ? 'Sincronizando...' : 'Sincronizar com banco online'}
              </button>
            </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
            marginTop: 16,
          }}
        >
          <div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Versao local conhecida</div>
            <div style={{ fontWeight: 700 }}>{formatDateTime(localUpdatedAt)}</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Versao online conhecida</div>
            <div style={{ fontWeight: 700 }}>{formatDateTime(remoteUpdatedAt)}</div>
          </div>
          <div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Status</div>
            <div style={{ fontWeight: 700 }}>
              {isOutdated ? 'Ha atualizacoes no Firebase aguardando sincronizacao' : 'Cache pronto para consulta local'}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ ...cardStyle, background: '#faf5ff', borderColor: '#e9d5ff' }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Produtos cadastrados</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.totalProducts}</div>
        </div>
        <div style={{ ...cardStyle, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ color: '#166534', fontSize: 13 }}>Na vitrine</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.activeInShowcase}</div>
        </div>
        <div style={{ ...cardStyle, background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div style={{ color: '#1d4ed8', fontSize: 13 }}>Em destaque na home</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.featuredProducts}</div>
        </div>
        <div style={{ ...cardStyle, background: '#fff7ed', borderColor: '#fed7aa' }}>
          <div style={{ color: '#9a3412', fontSize: 13 }}>Pecas disponiveis</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{stats.totalAvailableStock}</div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          Pesquisar produto
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            border: '1px solid #d1d5db',
            borderRadius: 14,
            padding: '0 14px',
            background: '#fff',
          }}
        >
          <FiSearch size={18} color="#6b7280" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busque por nome, categoria, fornecedor, tamanho ou cor"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              padding: '14px 0',
              fontSize: 15,
              background: 'transparent',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, color: '#6b7280' }}>Carregando produtos do estoque...</div>
      ) : error ? (
        <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ ...cardStyle, color: '#6b7280' }}>Nenhum produto encontrado para a pesquisa informada.</div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => navigate(`/logista/estoque/${product.id}`)}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                textAlign: 'left',
                padding: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
              }}
            >
              <div
                style={{
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  position: 'relative',
                  overflow: 'hidden',
                  aspectRatio: '1 / 1',
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
                      color: '#9ca3af',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      position: 'absolute',
                      inset: 0,
                    }}
                  >
                    <FiPackage size={32} />
                    <span>Sem foto</span>
                  </div>
                )}
              </div>

              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.available ? '#ecfdf5' : '#f3f4f6',
                      color: product.available ? '#166534' : '#6b7280',
                    }}
                  >
                    {product.available ? 'Na vitrine' : 'Oculto'}
                  </span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.featured ? '#faf5ff' : '#f9fafb',
                      color: product.featured ? '#7c3aed' : '#6b7280',
                    }}
                  >
                    {product.featured ? 'Destaque home' : 'Sem destaque'}
                  </span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.active ? '#eff6ff' : '#fef2f2',
                      color: product.active ? '#1d4ed8' : '#b91c1c',
                    }}
                  >
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{product.name}</div>
                <div style={{ color: '#6b7280', marginTop: 6, minHeight: 42 }}>
                  {product.description || 'Sem descricao cadastrada.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Preco de venda</div>
                    <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.salePrice)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Custo final</div>
                    <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.finalUnitCost)}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Estoque disponivel</div>
                    <div style={{ fontWeight: 700 }}>{product.availableStock}</div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', fontSize: 12 }}>Variacoes</div>
                    <div style={{ fontWeight: 700 }}>{product.totalVariations}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 6, marginTop: 16, color: '#4b5563', fontSize: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiBox size={16} />
                    <span>Categoria: {product.categoryName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiEye size={16} />
                    <span>Fornecedor: {product.supplierName}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FiStar size={16} />
                    <span>
                      Total: {product.totalStock} • Reservado: {product.reservedStock}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#7c3aed',
                    fontWeight: 700,
                  }}
                >
                  <span>Editar produto</span>
                  <FiChevronRight size={18} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
