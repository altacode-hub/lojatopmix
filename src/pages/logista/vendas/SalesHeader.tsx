import { cardStyle } from './helpers'

type SalesHeaderProps = {
  pendingDeliveriesCount: number
  totalSalesInPeriod: number
}

export default function SalesHeader({ pendingDeliveriesCount, totalSalesInPeriod }: SalesHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 32 }}>Vendas</h1>
        <div style={{ color: '#6b7280', marginTop: 6 }}>
          Registre vendas de balcao, acompanhe pedidos online e visualize o historico do periodo.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ ...cardStyle, padding: '14px 18px', minWidth: 180 }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Entregas pendentes</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: '#7c3aed' }}>{pendingDeliveriesCount}</div>
        </div>
        <div style={{ ...cardStyle, padding: '14px 18px', minWidth: 180 }}>
          <div style={{ color: '#6b7280', fontSize: 13 }}>Vendas no periodo</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: '#0f172a' }}>{totalSalesInPeriod}</div>
        </div>
      </div>
    </div>
  )
}
