import { cardStyle } from './helpers'
import { logistaTheme } from '../logistaTheme'

type SalesHeaderProps = {
  pendingDeliveriesCount: number
  totalSalesInPeriod: number
}

export default function SalesHeader({ pendingDeliveriesCount, totalSalesInPeriod }: SalesHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 32 }}>Vendas</h1>
        <div style={{ color: logistaTheme.colors.textMuted, marginTop: 6 }}>
          Registre vendas de balcao, acompanhe pedidos online e visualize o historico do periodo.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div
          style={{
            ...cardStyle,
            padding: '14px 18px',
            minWidth: 180,
            background: logistaTheme.colors.accentSoft,
            border: `1px solid ${logistaTheme.colors.accentBorder}`,
          }}
        >
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Entregas pendentes</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: logistaTheme.colors.accentDark }}>
            {pendingDeliveriesCount}
          </div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 18px', minWidth: 180 }}>
          <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>Vendas no periodo</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: logistaTheme.colors.text }}>
            {totalSalesInPeriod}
          </div>
        </div>
      </div>
    </div>
  )
}
