import { FiPlusCircle, FiRefreshCw, FiSearch, FiShoppingCart, FiX } from 'react-icons/fi'
import FramedImage from '../../../components/FramedImage'
import { useMediaQuery } from '../../../hooks/useMediaQuery'
import { variationLabel } from '../../../utils/catalog'
import { cardStyle, formatDateTime } from './helpers'
import type { CounterSaleItem, SaleableVariationRow } from './types'
import { isAdHocCounterSaleItem, isRegisteredCounterSaleItem } from './types'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'

type AdHocDraft = {
  productName: string
  description: string
  price: number
  qty: number
}

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
  draftLoadedFromCache: boolean
  openingPayment: boolean
  reservingProducts: boolean
  isAdHocModalOpen: boolean
  adHocDraft: AdHocDraft
  onSearchChange: (value: string) => void
  onAddItem: (row: SaleableVariationRow) => void
  onAddAdHocItem: () => void
  onCloseAdHocModal: () => void
  onUpdateAdHocDraftField: (field: 'productName' | 'description' | 'price' | 'qty', rawValue: string) => void
  onSaveAdHocItem: () => void
  onUpdateSelectedQty: (itemId: string, nextQty: number) => void
  onRemoveSelectedItem: (itemId: string) => void
  onClearAllSelectedItems: () => void
  onFinalizeCounterSale: () => void
  onReserveProducts: () => void
  onSyncCatalog: () => void
  formatCurrency: (value: number) => string
  getSelectedItemLineTotal: (item: CounterSaleItem) => number
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
  draftLoadedFromCache,
  openingPayment,
  reservingProducts,
  isAdHocModalOpen,
  adHocDraft,
  onSearchChange,
  onAddItem,
  onAddAdHocItem,
  onCloseAdHocModal,
  onUpdateAdHocDraftField,
  onSaveAdHocItem,
  onUpdateSelectedQty,
  onRemoveSelectedItem,
  onClearAllSelectedItems,
  onFinalizeCounterSale,
  onReserveProducts,
  onSyncCatalog,
  formatCurrency,
  getSelectedItemLineTotal,
}: CounterSaleSectionProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const normalizedSearchLength = search.trim().length
  const shouldShowResults = normalizedSearchLength >= minSearchLength
  const selectedTotalItems = selectedItems.reduce((sum, item) => sum + (item.qty > 0 ? item.qty : 0), 0)
  const hasInvalidAdHocItem = selectedItems.some((item) => {
    if (!isAdHocCounterSaleItem(item)) return false
    return !item.productName.trim() || item.price <= 0 || item.qty <= 0
  })

  const formatPriceInput = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return ''
    return value.toFixed(2).replace('.', ',')
  }

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
            <h2 style={{ margin: 0, fontSize: 24 }}>Venda no balcão</h2>
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
            {syncingCatalog ? 'Sincronizando...' : 'Sincronizar catalogo'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 14, color: logistaTheme.colors.text }}>
              Buscar por codigo ou descrição (mínimo {minSearchLength} caracteres)
            </span>
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Ex.: SKU, nome, descrição, cor ou tamanho"
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
              Se os dados estiverem desatualizados, use o botão Sincronizar catálogo.
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
              Tente outro código ou descrição, ou sincronize o catálogo com o banco online.
            </div>
          ) : null}

          {!loading && shouldShowResults
            ? filteredCatalog.map((row) => (
                <div
                  key={row.id}
                  style={{
                    border: `1px solid ${logistaTheme.colors.border}`,
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      width: 92,
                      flex: '0 0 92px',
                      aspectRatio: '1 / 1',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px solid ${logistaTheme.colors.border}`,
                      background: logistaTheme.colors.surfaceAlt,
                    }}
                  >
                    <FramedImage
                      src={row.image || ''}
                      alt={row.productName}
                      zoom={Number(row.mainImageZoom ?? 1)}
                      offsetX={Number(row.mainImageOffsetX ?? 0)}
                      offsetY={Number(row.mainImageOffsetY ?? 0)}
                      style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                  </div>

                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
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
                        Código: {row.productId}
                      </span>
                    </div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                      {row.description || 'Sem descrição cadastrada.'}
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
                      <span>Disponível: {row.variation.stock}</span>
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
                      width: isMobile ? '100%' : 'auto',
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

      <aside style={{ ...cardStyle, flex: '1 1 380px', minWidth: 0, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiShoppingCart size={18} />
            <h2 style={{ margin: 0, fontSize: 24 }}>Itens da venda</h2>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onAddAdHocItem}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: logistaTheme.radius.md,
                border: `1px solid ${logistaTheme.colors.warningBorder}`,
                background: logistaTheme.colors.warningBackground,
                color: logistaTheme.colors.warningText,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <FiPlusCircle size={16} />
              Adicionar produto avulso
            </button>

            {selectedItems.length > 0 ? (
              <button
                type="button"
                onClick={onClearAllSelectedItems}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: logistaTheme.radius.md,
                  border: `1px solid ${logistaTheme.colors.errorBorder}`,
                  background: logistaTheme.colors.errorBackground,
                  color: logistaTheme.colors.errorText,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <FiX size={16} />
                Limpar itens
              </button>
            ) : null}
          </div>
        </div>

        {draftLoadedFromCache ? (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.infoBorder}`,
              background: logistaTheme.colors.infoBackground,
              color: logistaTheme.colors.infoText,
              fontSize: 13,
            }}
          >
            Os itens abaixo foram restaurados automaticamente a partir do rascunho local.
          </div>
        ) : null}

        {selectedItems.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              background: logistaTheme.colors.surfaceAlt,
              color: logistaTheme.colors.textMuted,
            }}
          >
            Adicione um ou mais itens para registrar a venda do atendimento no balcão.
            Para itens não cadastrados, use o botão Adicionar produto avulso.
            Os itens são salvos automaticamente no cache local desta área.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {selectedItems.map((item) => (
              <div
                key={item.id}
                style={{ border: `1px solid ${logistaTheme.colors.border}`, borderRadius: 14, padding: 12, background: logistaTheme.colors.surface }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: 72,
                      flex: '0 0 72px',
                      aspectRatio: '1 / 1',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: `1px solid ${logistaTheme.colors.border}`,
                      background: logistaTheme.colors.surfaceAlt,
                    }}
                  >
                    {isRegisteredCounterSaleItem(item) ? (
                      <FramedImage
                        src={item.image || ''}
                        alt={item.productName}
                        zoom={Number(item.mainImageZoom ?? 1)}
                        offsetX={Number(item.mainImageOffsetX ?? 0)}
                        offsetY={Number(item.mainImageOffsetY ?? 0)}
                        style={{ width: '100%', height: '100%', display: 'block' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: logistaTheme.colors.textMuted,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        Avulso
                      </div>
                    )}
                  </div>

                  <div style={{ flex: '1 1 220px', minWidth: 0, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'grid', gap: 4, flex: '1 1 180px', minWidth: 0 }}>
                        {isRegisteredCounterSaleItem(item) ? (
                          <>
                            <div style={{ fontWeight: 700 }}>{item.productName}</div>
                            <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                              {variationLabel(item.variation)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 700 }}>{item.productName}</div>
                            {item.description ? (
                              <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>
                                {item.description}
                              </div>
                            ) : null}
                            <span
                              style={{
                                fontSize: 12,
                                color: logistaTheme.colors.textMuted,
                              }}
                            >
                              Item não cadastrado
                            </span>
                          </>
                        )}
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

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginTop: 4,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>Quantidade</span>
                          <input
                            type="number"
                            min={1}
                            max={isRegisteredCounterSaleItem(item) ? item.variation.stock : undefined}
                            value={item.qty}
                            onChange={(event) => onUpdateSelectedQty(item.id, Number(event.target.value))}
                            style={{
                              ...logistaInputStyle,
                              width: isMobile ? '100%' : 88,
                              maxWidth: isMobile ? '100%' : 88,
                              padding: '10px 12px',
                            }}
                          />
                        </label>

                        <label style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>Valor unitário</span>
                          <div
                            style={{
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: `1px solid ${logistaTheme.colors.border}`,
                              background: logistaTheme.colors.surfaceAlt,
                              color: logistaTheme.colors.text,
                              fontWeight: 700,
                              width: isMobile ? '100%' : 140,
                              maxWidth: isMobile ? '100%' : 140,
                              boxSizing: 'border-box',
                            }}
                          >
                            {formatCurrency(item.price)}
                          </div>
                        </label>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {formatCurrency(getSelectedItemLineTotal(item))}
                      </div>
                    </div>
                  </div>
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
            <strong>{selectedTotalItems}</strong>
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

          {hasInvalidAdHocItem ? (
            <div
              style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 12,
                border: `1px solid ${logistaTheme.colors.warningBorder}`,
                background: logistaTheme.colors.warningBackground,
                color: logistaTheme.colors.warningText,
                fontSize: 13,
              }}
            >
              Existe pelo menos um item avulso sem nome, quantidade ou valor unitário. Preencha antes de seguir.
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={onReserveProducts}
              disabled={openingPayment || reservingProducts || selectedItems.length === 0 || hasInvalidAdHocItem}
              style={{
                flex: '1 1 180px',
                padding: '14px 16px',
                borderRadius: 14,
                border: `1px solid ${logistaTheme.colors.warningBorder}`,
                background: logistaTheme.colors.warningBackground,
                color: logistaTheme.colors.warningText,
                fontWeight: 800,
                cursor: openingPayment || reservingProducts || selectedItems.length === 0 || hasInvalidAdHocItem ? 'not-allowed' : 'pointer',
                opacity: openingPayment || reservingProducts || selectedItems.length === 0 || hasInvalidAdHocItem ? 0.7 : 1,
              }}
            >
              {reservingProducts ? 'Reservando...' : 'Reservar produtos'}
            </button>

            <button
              onClick={onFinalizeCounterSale}
              disabled={openingPayment || reservingProducts || selectedItems.length === 0 || hasInvalidAdHocItem}
              style={{
                flex: '1 1 180px',
                marginLeft: 'auto',
                padding: '14px 16px',
                borderRadius: 14,
                border: 'none',
                background: logistaTheme.colors.accent,
                color: logistaTheme.colors.surface,
                fontWeight: 800,
                cursor: openingPayment || reservingProducts || selectedItems.length === 0 || hasInvalidAdHocItem ? 'not-allowed' : 'pointer',
                opacity: openingPayment || reservingProducts || selectedItems.length === 0 || hasInvalidAdHocItem ? 0.7 : 1,
              }}
            >
              {openingPayment ? 'Abrindo pagamento...' : 'Ir para pagamento'}
            </button>
          </div>
        </div>
      </aside>

      {isAdHocModalOpen ? (
        <div
          onClick={onCloseAdHocModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: logistaTheme.colors.surface,
              borderRadius: 18,
              border: `1px solid ${logistaTheme.colors.border}`,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25)',
              padding: 24,
              animation: 'adHocFadeIn 0.18s ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FiPlusCircle size={20} />
                <h3 style={{ margin: 0, fontSize: 22 }}>Adicionar produto avulso</h3>
              </div>
              <button
                type="button"
                onClick={onCloseAdHocModal}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 999,
                  color: logistaTheme.colors.textMuted,
                }}
                aria-label="Fechar"
              >
                <FiX size={22} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text, fontWeight: 600 }}>
                  Nome do produto <span style={{ color: logistaTheme.colors.errorText }}>*</span>
                </span>
                <input
                  value={adHocDraft.productName}
                  onChange={(event) => onUpdateAdHocDraftField('productName', event.target.value)}
                  placeholder="Ex.: Serviço, taxa ou item não cadastrado"
                  autoFocus
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderColor: !adHocDraft.productName.trim() ? logistaTheme.colors.warningBorder : undefined,
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 14, color: logistaTheme.colors.text, fontWeight: 600 }}>Descrição (opcional)</span>
                <textarea
                  value={adHocDraft.description}
                  onChange={(event) => onUpdateAdHocDraftField('description', event.target.value)}
                  placeholder="Observações ou detalhes adicionais"
                  rows={3}
                  style={{
                    ...logistaInputStyle,
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 14, color: logistaTheme.colors.text, fontWeight: 600 }}>
                    Quantidade <span style={{ color: logistaTheme.colors.errorText }}>*</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={adHocDraft.qty}
                    onChange={(event) => onUpdateAdHocDraftField('qty', event.target.value)}
                    style={{
                      ...logistaInputStyle,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                    }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 14, color: logistaTheme.colors.text, fontWeight: 600 }}>
                    Valor unitário <span style={{ color: logistaTheme.colors.errorText }}>*</span>
                  </span>
                  <input
                    value={formatPriceInput(adHocDraft.price)}
                    onChange={(event) => onUpdateAdHocDraftField('price', event.target.value)}
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    style={{
                      ...logistaInputStyle,
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderColor: adHocDraft.price <= 0 ? logistaTheme.colors.warningBorder : undefined,
                    }}
                  />
                </label>
              </div>

              {adHocDraft.price > 0 && adHocDraft.qty > 0 ? (
                <div
                  style={{
                    marginTop: 4,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: logistaTheme.colors.accentSoft,
                    border: `1px solid ${logistaTheme.colors.accentBorder}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 15,
                  }}
                >
                  <span style={{ color: logistaTheme.colors.text }}>
                    Subtotal ({adHocDraft.qty} x {formatCurrency(adHocDraft.price)})
                  </span>
                  <strong style={{ color: logistaTheme.colors.accentDark }}>
                    {formatCurrency(adHocDraft.price * adHocDraft.qty)}
                  </strong>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                type="button"
                onClick={onCloseAdHocModal}
                style={{
                  padding: '12px 18px',
                  borderRadius: 12,
                  border: `1px solid ${logistaTheme.colors.border}`,
                  background: logistaTheme.colors.surfaceAlt,
                  color: logistaTheme.colors.text,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSaveAdHocItem}
                style={{
                  padding: '12px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: logistaTheme.colors.accent,
                  color: logistaTheme.colors.surface,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Salvar e adicionar
              </button>
            </div>
          </div>
          <style>{`
            @keyframes adHocFadeIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      ) : null}
    </div>
  )
}
