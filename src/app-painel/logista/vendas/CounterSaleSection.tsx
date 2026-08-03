import { FiRefreshCw, FiSearch, FiShoppingCart, FiX } from 'react-icons/fi'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { variationLabel } from '../../../utils/catalog'
import { cardStyle, formatCurrency, formatDateTime } from './helpers'
import type { CounterSaleItem, SaleableVariationRow } from './types'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'

type CounterSaleSectionProps = {
  loading: boolean
  syncingCatalog: boolean
  search: string
  minSearchLength: number
  catalogCount: number
  catalogSource: 'local' | 'remote'
  catalogSyncedAt: number
  filteredCatalog: SaleableVariationRow[]
  selectedItems: CounterSaleItem[]
  selectedTotal: number
  openingPayment: boolean
  reservingProducts: boolean
  onSearchChange: (value: string) => void
  onAddItem: (row: SaleableVariationRow) => void
  onUpdateSelectedQty: (itemId: string, nextQty: number) => void
  onRemoveSelectedItem: (itemId: string) => void
  onFinalizeCounterSale: () => void
  onReserveProducts: () => void
  onSyncCatalog: () => void
}

export default function CounterSaleSection({
  loading,
  syncingCatalog,
  search,
  minSearchLength,
  catalogCount,
  catalogSource,
  catalogSyncedAt,
  filteredCatalog,
  selectedItems,
  selectedTotal,
  openingPayment,
  reservingProducts,
  onSearchChange,
  onAddItem,
  onUpdateSelectedQty,
  onRemoveSelectedItem,
  onFinalizeCounterSale,
  onReserveProducts,
  onSyncCatalog,
}: CounterSaleSectionProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const normalizedSearchLength = search.trim().length
  const shouldShowResults = normalizedSearchLength >= minSearchLength

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 24,
        alignItems: 'flex-start',
      }}
    >
      <section style={{ ...cardStyle, flex: '1 1 560px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiSearch size={18} />
            <h2 style={{ margin: 0, fontSize: 24 }}>Venda no balcao</h2>
          </div>

          <button
            type="button"
            onClick={onSyncCatalog}
            disabled={syncingCatalog}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: logistaTheme.radius.md,
              border: `1px solid ${logistaTheme.colors.accentBorder}`,
              background: logistaTheme.colors.accentSoft,
              color: logistaTheme.colors.accentDark,
              fontWeight: 700,
              fontSize: 14,
              cursor: syncingCatalog ? 'not-allowed' : 'pointer',
              opacity: syncingCatalog ? 0.7 : 1,
            }}
          >
            <FiRefreshCw size={16} style={{ animation: syncingCatalog ? 'spin 1s linear infinite' : undefined }} />
            {syncingCatalog ? 'Atualizando...' : 'Sincronizar catalogo'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>
              Buscar por codigo ou descrição (minimo {minSearchLength} caracteres)
            </span>
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Ex.: SKU, nome, descricao, cor ou tamanho"
              style={{
                ...logistaInputStyle,
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            />
          </label>

          <div style={{ fontSize: 13, color: logistaTheme.colors.textMuted }}>
            Base atual: {catalogCount} variaçõs ·{' '}
            {catalogSource === 'local' ? 'Consulta em cache local' : 'Consulta sincronizada online'}
            {catalogSyncedAt ? ` · ${formatDateTime(catalogSyncedAt)}` : ''}
          </div>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          {loading ? <div style={{ color: logistaTheme.colors.textMuted }}>Carregando dados da tela...</div> : null}

          {!loading && !shouldShowResults ? (
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                background: logistaTheme.colors.surfaceAlt,
                color: logistaTheme.colors.textMuted,
              }}
            >
              Digite pelo menos {minSearchLength} caracteres para consultar os produtos no cache local.
              Se os dados estiverem desatualizados, use o botao Sincronizar catalogo.
            </div>
          ) : null}

          {!loading && shouldShowResults && filteredCatalog.length === 0 ? (
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                background: logistaTheme.colors.surfaceAlt,
                color: logistaTheme.colors.textMuted,
              }}
            >
              Nenhum item encontrado no cache local com esses termos.
              Tente outro codigo ou descricao, ou sincronize o catalogo com o banco online.
            </div>
          ) : null}

          {!loading && shouldShowResults
            ? filteredCatalog.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: `1px solid ${logistaTheme.colors.border}`,
                    borderRadius: 14,
                    padding: 16,
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: logistaTheme.colors.text }}>{row.productName}</span>
                      <span
                        style={{
                          padding: '2px 10px',
                          borderRadius: 999,
                          background: logistaTheme.colors.accentSoft,
                          color: logistaTheme.colors.accentDark,
                          fontSize: 12,
                        }}
                      >
                        Codigo: {row.productId}
                      </span>
                    </div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                      {row.description || 'Sem descricao cadastrada.'}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                        marginTop: 10,
                        color: logistaTheme.colors.text,
                        fontSize: 14,
                      }}
                    >
                      <span>{variationLabel(row.variation)}</span>
                      <span>Disponivel: {row.variation.stock}</span>
                      <span>{formatCurrency(row.price)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onAddItem(row)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: logistaTheme.colors.accent,
                      color: logistaTheme.colors.surface,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Adicionar
                  </button>
                </div>
              ))
            : null}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);}}`}</style>
      </section>

      <aside style={{ ...cardStyle, flex: '1 1 360px', minWidth: 0, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FiShoppingCart size={18} />
          <h2 style={{ margin: 0, fontSize: 24 }}>Itens da venda</h2>
        </div>

        {selectedItems.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: logistaTheme.colors.surfaceAlt,
              color: logistaTheme.colors.textMuted,
            }}
          >
            Adicione um ou mais itens para registrar a venda do atendimento no balcao.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {selectedItems.map((item) => (
              <div key={item.id} style={{ border: `1px solid ${logistaTheme.colors.border}`, borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.productName}</div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>{variationLabel(item.variation)}</div>
                  </div>
                  <button
                    onClick={() => onRemoveSelectedItem(item.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: logistaTheme.colors.errorText,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label="Remover item"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                  <input
                    type="number"
                    min={1}
                    max={item.variation.stock}
                    value={item.qty}
                    onChange={(event) => onUpdateSelectedQty(item.id, Number(event.target.value))}
                    style={{
                      ...logistaInputStyle,
                      width: isMobile ? '100%' : 88,
                      maxWidth: isMobile ? '100%' : 88,
                      padding: '10px 12px',
                    }}
                  />
                  <div style={{ fontWeight: 700 }}>{formatCurrency(item.qty * item.price)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${logistaTheme.colors.border}` }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 8,
              color: logistaTheme.colors.textMuted,
            }}
          >
            <span>Itens</span>
            <strong>{selectedItems.reduce((sum, item) => sum + item.qty, 0)}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 18,
              color: logistaTheme.colors.text,
              fontSize: 18,
            }}
          >
            <span>Total</span>
            <strong>{formatCurrency(selectedTotal)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={onReserveProducts}
              disabled={openingPayment || reservingProducts || selectedItems.length === 0}
              style={{
                flex: '1 1 180px',
                padding: '14px 16px',
                borderRadius: 14,
                border: `1px solid ${logistaTheme.colors.warningBorder}`,
                background: logistaTheme.colors.warningBackground,
                color: logistaTheme.colors.warningText,
                fontWeight: 800,
                cursor: openingPayment || reservingProducts || selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: openingPayment || reservingProducts || selectedItems.length === 0 ? 0.7 : 1,
              }}
            >
              {reservingProducts ? 'Reservando...' : 'Reservar produtos'}
            </button>

            <button
              onClick={onFinalizeCounterSale}
              disabled={openingPayment || reservingProducts || selectedItems.length === 0}
              style={{
                flex: '1 1 180px',
                marginLeft: 'auto',
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                background: logistaTheme.colors.accent,
                color: logistaTheme.colors.surface,
                fontWeight: 800,
                cursor: openingPayment || reservingProducts || selectedItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: openingPayment || reservingProducts || selectedItems.length === 0 ? 0.7 : 1,
              }}
            >
              {openingPayment ? 'Abrindo pagamento...' : 'Ir para pagamento'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
