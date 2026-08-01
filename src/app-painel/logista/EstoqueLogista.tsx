import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { get, onValue, ref } from 'firebase/database'
import { useNavigate } from 'react-router-dom'
import { FiAlertCircle, FiBox, FiChevronRight, FiDatabase, FiEye, FiPackage, FiRefreshCw, FiSearch, FiStar } from 'react-icons/fi'
import FramedImage from '../../components/FramedImage'
import { rtdb } from '../../service/firebase'
import type { InternalProductRecord, ShowcaseRecord } from '../../types/catalog'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import {
  buildInventoryRows,
  CATALOG_SYNC_PATH,
  type InventoryProductRow,
  type InventoryRecord,
  normalizeText,
  readStockCache,
  writeStockCache,
} from './stockCache'
import { logistaCardStyle, logistaInputStyle, logistaTheme } from './logistaTheme'

const cardStyle: CSSProperties = logistaCardStyle

const statLabelStyle: CSSProperties = {
  fontSize: 12,
  color: logistaTheme.colors.textMuted,
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
  const isMobile = useMediaQuery('(max-width: 768px)')
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
          <h1 style={{ margin: 0, fontSize: 30 }}>Estoque da loja</h1>
          <p style={{ margin: '8px 0 0', color: logistaTheme.colors.textMuted, maxWidth: 720 }}>
            Consulte primeiro o banco local para economizar leituras do Firebase, sincronize quando desejar e acompanhe
            se o cache esta atualizado em relacao ao banco online.
          </p>
        </div>
      </div>

      <div
        style={{
          ...cardStyle,
          marginBottom: 20,
          borderColor: isOutdated ? logistaTheme.colors.warningBorder : logistaTheme.colors.successBorder,
          background: isOutdated ? logistaTheme.colors.warningBackground : logistaTheme.colors.successBackground,
        }}
      >
        <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12, justifyContent: 'space-between' }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: isMobile ? 'flex-start' : 'center',
                  alignItems: 'center',
                  fontWeight: 700,
                  color: isOutdated ? logistaTheme.colors.warningText : logistaTheme.colors.successText,
                }}
              >
                {isOutdated ? (
                  <FiAlertCircle size={20} color={logistaTheme.colors.warningText} />
                ) : (
                  <FiDatabase size={20} color={logistaTheme.colors.successText} />
                )}
            
                <span style={{ marginLeft: 8 }}>{`${isOutdated ? 'Banco local desatualizado' : 'Banco local sincronizado'}`}</span>
              </div>
              <div style={{ color: isOutdated ? logistaTheme.colors.warningText : logistaTheme.colors.successText, marginTop: 4 }}>
                Fonte atual: {cacheSource === 'online' ? 'sincronizacao online mais recente' : 'cache local'}.
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                justifyContent: isMobile ? 'stretch' : 'center',
                justifyItems: isMobile ? 'stretch' : 'center',
              }}
            >
              <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14, textAlign: isMobile ? 'left' : 'center' }}>
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
                  background: logistaTheme.colors.accent,
                  color: logistaTheme.colors.surface,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700,
                  opacity: syncing ? 0.7 : 1,
                  width: isMobile ? '100%' : 'auto',
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
            <div style={statLabelStyle}>Versao local conhecida</div>
            <div style={{ fontWeight: 700 }}>{formatDateTime(localUpdatedAt)}</div>
          </div>
          <div>
            <div style={statLabelStyle}>Versao online conhecida</div>
            <div style={{ fontWeight: 700 }}>{formatDateTime(remoteUpdatedAt)}</div>
          </div>
          <div>
            <div style={statLabelStyle}>Status</div>
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
        <div style={{ ...cardStyle, background: logistaTheme.colors.accentSoft, borderColor: logistaTheme.colors.accentBorder }}>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Produtos cadastrados</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.accentDark }}>{stats.totalProducts}</div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.successBackground, borderColor: logistaTheme.colors.successBorder }}>
          <div style={{ color: logistaTheme.colors.successText, fontSize: 13 }}>Na vitrine</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.successText }}>{stats.activeInShowcase}</div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.surfaceAlt, borderColor: logistaTheme.colors.borderStrong }}>
          <div style={{ color: logistaTheme.colors.accentDark, fontSize: 13 }}>Em destaque na home</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.accentDark }}>{stats.featuredProducts}</div>
        </div>
        <div style={{ ...cardStyle, background: logistaTheme.colors.warningBackground, borderColor: logistaTheme.colors.warningBorder }}>
          <div style={{ color: logistaTheme.colors.warningText, fontSize: 13 }}>Pecas disponiveis</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 10, color: logistaTheme.colors.warningText }}>{stats.totalAvailableStock}</div>
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
            border: `1px solid ${logistaTheme.colors.borderStrong}`,
            borderRadius: 14,
            padding: '0 14px',
            background: logistaTheme.colors.surface,
          }}
        >
          <FiSearch size={18} color={logistaTheme.colors.textMuted} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busque por nome, categoria, fornecedor, tamanho ou cor"
            style={{
              ...logistaInputStyle,
              width: '100%',
              border: 'none',
              padding: '14px 0',
              fontSize: 15,
              background: 'transparent',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ ...cardStyle, color: logistaTheme.colors.textMuted }}>Carregando produtos do estoque...</div>
      ) : error ? (
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
      ) : filteredProducts.length === 0 ? (
        <div style={{ ...cardStyle, color: logistaTheme.colors.textMuted }}>
          Nenhum produto encontrado para a pesquisa informada.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => navigate(`/estoque/${product.id}`)}
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
                  background: logistaTheme.colors.surfaceAlt,
                  borderBottom: `1px solid ${logistaTheme.colors.border}`,
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
                      color: logistaTheme.colors.textMuted,
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
                      background: product.available ? logistaTheme.colors.successBackground : logistaTheme.colors.surfaceAlt,
                      color: product.available ? logistaTheme.colors.successText : logistaTheme.colors.textMuted,
                    }}
                  >
                    {product.available ? 'Na vitrine' : 'Oculto'}
                  </span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.featured ? logistaTheme.colors.accentSoft : logistaTheme.colors.surfaceAlt,
                      color: product.featured ? logistaTheme.colors.accentDark : logistaTheme.colors.textMuted,
                    }}
                  >
                    {product.featured ? 'Destaque home' : 'Sem destaque'}
                  </span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      background: product.active ? logistaTheme.colors.surfaceAlt : logistaTheme.colors.errorBackground,
                      color: product.active ? logistaTheme.colors.accentDark : logistaTheme.colors.errorText,
                    }}
                  >
                    {product.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div style={{ fontSize: 20, fontWeight: 700, color: logistaTheme.colors.text }}>{product.name}</div>
                <div style={{ color: logistaTheme.colors.textMuted, marginTop: 6, minHeight: 42 }}>
                  {product.description || 'Sem descricao cadastrada.'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
                  <div>
                    <div style={statLabelStyle}>Preco de venda</div>
                    <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.salePrice)}</div>
                  </div>
                  <div>
                    <div style={statLabelStyle}>Custo final</div>
                    <div style={{ fontWeight: 700 }}>{currencyFormatter.format(product.finalUnitCost)}</div>
                  </div>
                  <div>
                    <div style={statLabelStyle}>Estoque disponivel</div>
                    <div style={{ fontWeight: 700 }}>{product.availableStock}</div>
                  </div>
                  <div>
                    <div style={statLabelStyle}>Variacoes</div>
                    <div style={{ fontWeight: 700 }}>{product.totalVariations}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 6, marginTop: 16, color: logistaTheme.colors.textMuted, fontSize: 14 }}>
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
                    color: logistaTheme.colors.accentDark,
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
