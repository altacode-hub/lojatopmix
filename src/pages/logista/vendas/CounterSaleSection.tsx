import { FiSearch, FiShoppingCart, FiX } from 'react-icons/fi'
import { variationLabel } from '../../../utils/catalog'
import { cardStyle, formatCurrency } from './helpers'
import type { CounterSaleItem, SaleableVariationRow } from './types'

type CounterSaleSectionProps = {
  loading: boolean
  search: string
  filteredCatalog: SaleableVariationRow[]
  selectedItems: CounterSaleItem[]
  selectedTotal: number
  savingCounterSale: boolean
  onSearchChange: (value: string) => void
  onAddItem: (row: SaleableVariationRow) => void
  onUpdateSelectedQty: (itemId: string, nextQty: number) => void
  onRemoveSelectedItem: (itemId: string) => void
  onFinalizeCounterSale: () => void
}

export default function CounterSaleSection({
  loading,
  search,
  filteredCatalog,
  selectedItems,
  selectedTotal,
  savingCounterSale,
  onSearchChange,
  onAddItem,
  onUpdateSelectedQty,
  onRemoveSelectedItem,
  onFinalizeCounterSale,
}: CounterSaleSectionProps) {
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <section style={{ ...cardStyle, flex: '1 1 680px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FiSearch size={18} />
          <h2 style={{ margin: 0, fontSize: 24 }}>Venda no balcao</h2>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 14, color: '#334155' }}>Buscar por codigo ou descricao</span>
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Ex.: SKU, nome, descricao, cor ou tamanho"
              style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1' }}
            />
          </label>
        </div>

        <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
          {loading ? <div style={{ color: '#6b7280' }}>Carregando catalogo...</div> : null}

          {!loading && filteredCatalog.length === 0 ? (
            <div style={{ padding: 20, borderRadius: 14, background: '#f8fafc', color: '#64748b' }}>
              Nenhum item encontrado com esse codigo ou descricao.
            </div>
          ) : null}

          {filteredCatalog.map((row) => (
            <div
              key={row.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 16,
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{row.productName}</span>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 999,
                      background: '#f1f5f9',
                      color: '#334155',
                      fontSize: 12,
                    }}
                  >
                    Codigo: {row.productId}
                  </span>
                </div>
                <div style={{ color: '#475569', fontSize: 14 }}>{row.description || 'Sem descricao cadastrada.'}</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10, color: '#334155', fontSize: 14 }}>
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
                  background: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Adicionar
              </button>
            </div>
          ))}
        </div>
      </section>

      <aside style={{ ...cardStyle, flex: '1 1 360px', minWidth: 320, alignSelf: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FiShoppingCart size={18} />
          <h2 style={{ margin: 0, fontSize: 24 }}>Itens da venda</h2>
        </div>

        {selectedItems.length === 0 ? (
          <div style={{ padding: 18, borderRadius: 14, background: '#f8fafc', color: '#64748b' }}>
            Adicione um ou mais itens para registrar a venda do atendimento no balcao.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {selectedItems.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.productName}</div>
                    <div style={{ color: '#64748b', fontSize: 14 }}>{variationLabel(item.variation)}</div>
                  </div>
                  <button
                    onClick={() => onRemoveSelectedItem(item.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label="Remover item"
                  >
                    <FiX size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 12 }}>
                  <input
                    type="number"
                    min={1}
                    max={item.variation.stock}
                    value={item.qty}
                    onChange={(event) => onUpdateSelectedQty(item.id, Number(event.target.value))}
                    style={{ width: 88, padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1' }}
                  />
                  <div style={{ fontWeight: 700 }}>{formatCurrency(item.qty * item.price)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#475569' }}>
            <span>Itens</span>
            <strong>{selectedItems.reduce((sum, item) => sum + item.qty, 0)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, color: '#0f172a', fontSize: 18 }}>
            <span>Total</span>
            <strong>{formatCurrency(selectedTotal)}</strong>
          </div>
          <button
            onClick={onFinalizeCounterSale}
            disabled={savingCounterSale || selectedItems.length === 0}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: '#fff',
              fontWeight: 800,
              cursor: savingCounterSale || selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              opacity: savingCounterSale || selectedItems.length === 0 ? 0.7 : 1,
            }}
          >
            {savingCounterSale ? 'Finalizando venda...' : 'Finalizar venda'}
          </button>
        </div>
      </aside>
    </div>
  )
}
