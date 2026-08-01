import { FiCheckCircle, FiClock, FiPackage, FiShoppingCart } from 'react-icons/fi'
import { cardStyle, formatCurrency, formatDateTime, getStatusMeta } from './helpers'
import type { SaleRecord } from './types'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'

type SalesHistorySectionProps = {
  periodStart: string
  periodEnd: string
  filteredSales: SaleRecord[]
  historyStats: {
    totalSales: number
    totalRevenue: number
    totalItems: number
  }
  onPeriodStartChange: (value: string) => void
  onPeriodEndChange: (value: string) => void
}

export default function SalesHistorySection({
  periodStart,
  periodEnd,
  filteredSales,
  historyStats,
  onPeriodStartChange,
  onPeriodEndChange,
}: SalesHistorySectionProps) {
  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiPackage size={18} />
          <h2 style={{ margin: 0, fontSize: 24 }}>Historico de vendas</h2>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: logistaTheme.colors.textMuted }}>Início</span>
            <input
              type="date"
              value={periodStart}
              onChange={(event) => onPeriodStartChange(event.target.value)}
              style={{ ...logistaInputStyle, padding: '10px 12px' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: logistaTheme.colors.textMuted }}>Fim</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => onPeriodEndChange(event.target.value)}
              style={{ ...logistaInputStyle, padding: '10px 12px' }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 20 }}>
        <div style={{ ...cardStyle, padding: 16, background: logistaTheme.colors.accentSoft, border: `1px solid ${logistaTheme.colors.accentBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: logistaTheme.colors.textMuted }}>
            <FiShoppingCart />
            <span>Vendas</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: logistaTheme.colors.accentDark }}>
            {historyStats.totalSales}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 16, background: logistaTheme.colors.successBackground, border: `1px solid ${logistaTheme.colors.successBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: logistaTheme.colors.successText }}>
            <FiCheckCircle />
            <span>Faturamento</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: logistaTheme.colors.successText }}>
            {formatCurrency(historyStats.totalRevenue)}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: 16, background: logistaTheme.colors.warningBackground, border: `1px solid ${logistaTheme.colors.warningBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: logistaTheme.colors.warningText }}>
            <FiClock />
            <span>Itens vendidos</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: logistaTheme.colors.warningText }}>
            {historyStats.totalItems}
          </div>
        </div>
      </div>

      {filteredSales.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 14,
            background: logistaTheme.colors.surfaceAlt,
            color: logistaTheme.colors.textMuted,
          }}
        >
          Nenhuma venda encontrada no periodo selecionado.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filteredSales.map((sale) => {
            const statusMeta = getStatusMeta(sale)

            return (
              <div
                key={sale.saleId}
                style={{
                  border: `1px solid ${logistaTheme.colors.border}`,
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <strong>{sale.channel === 'online' ? 'Venda online' : 'Venda no balcao'}</strong>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: statusMeta.background,
                          color: statusMeta.color,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                      Codigo: {sale.saleId} • Criada em {formatDateTime(sale.createdAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 20, color: logistaTheme.colors.text }}>
                      {formatCurrency(sale.totalAmount)}
                    </div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>{sale.totalItems} item(ns)</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {(sale.items || []).map((item, index) => (
                    <div
                      key={`${sale.saleId}-history-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: logistaTheme.colors.surfaceAlt,
                      }}
                    >
                      <span>
                        {item.productName} • {item.size || '-'} {item.color ? `• ${item.color}` : ''}
                      </span>
                      <strong>
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: logistaTheme.colors.textMuted, fontSize: 14 }}>
                  {sale.customer?.name ? <span>Cliente: {sale.customer.name}</span> : null}
                  {sale.orderNsu ? <span>Pedido online: {sale.orderNsu}</span> : null}
                  {sale.deliveredAt ? <span>Entregue em {formatDateTime(sale.deliveredAt)}</span> : null}
                </div>

                {sale.alerts && sale.alerts.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gap: 6,
                      color: logistaTheme.colors.warningText,
                      background: logistaTheme.colors.warningBackground,
                      borderRadius: 12,
                      padding: 12,
                      border: `1px solid ${logistaTheme.colors.warningBorder}`,
                    }}
                  >
                    {sale.alerts.map((alert, index) => (
                      <div key={`${sale.saleId}-history-alert-${index}`}>{alert}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
