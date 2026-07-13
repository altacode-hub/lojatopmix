import { FiTruck } from 'react-icons/fi'
import { cardStyle, formatCurrency, formatDateTime, getStatusMeta } from './helpers'
import type { SaleRecord } from './types'

type PendingDeliveriesSectionProps = {
  pendingDeliveries: SaleRecord[]
  deliveringSaleId: string | null
  onConfirmDelivery: (sale: SaleRecord) => void
}

export default function PendingDeliveriesSection({
  pendingDeliveries,
  deliveringSaleId,
  onConfirmDelivery,
}: PendingDeliveriesSectionProps) {
  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiTruck size={18} />
          <h2 style={{ margin: 0, fontSize: 24 }}>Entregas de vendas online</h2>
        </div>
        <div style={{ color: '#64748b' }}>Pagamentos aprovados no site aparecem aqui para separacao e entrega.</div>
      </div>

      {pendingDeliveries.length === 0 ? (
        <div style={{ padding: 18, borderRadius: 14, background: '#f8fafc', color: '#64748b' }}>
          Nenhuma venda online pendente no momento.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {pendingDeliveries.map((sale) => {
            const statusMeta = getStatusMeta(sale)

            return (
              <div
                key={sale.saleId}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: 16,
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong>{sale.customer?.name || 'Cliente do site'}</strong>
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
                    <div style={{ marginTop: 6, color: '#64748b', fontSize: 14 }}>
                      Pedido: {sale.orderNsu || sale.saleId} • Criado em {formatDateTime(sale.createdAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(sale.totalAmount)}</div>
                    <div style={{ color: '#64748b', fontSize: 14 }}>{sale.totalItems} item(ns)</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {(sale.items || []).map((item, index) => (
                    <div
                      key={`${sale.saleId}-${index}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: '#f8fafc',
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

                {sale.address ? (
                  <div style={{ color: '#475569', fontSize: 14 }}>
                    Entrega: CEP {sale.address.cep || '-'} • Numero {sale.address.number || '-'} • Complemento{' '}
                    {sale.address.complement || '-'}
                  </div>
                ) : null}

                {sale.alerts && sale.alerts.length > 0 ? (
                  <div style={{ display: 'grid', gap: 6, color: '#9a3412', background: '#fff7ed', borderRadius: 12, padding: 12 }}>
                    {sale.alerts.map((alert, index) => (
                      <div key={`${sale.saleId}-alert-${index}`}>{alert}</div>
                    ))}
                  </div>
                ) : null}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => onConfirmDelivery(sale)}
                    disabled={sale.fulfillmentStatus === 'pending_review' || deliveringSaleId === sale.saleId}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 12,
                      border: 'none',
                      background: sale.fulfillmentStatus === 'pending_review' ? '#e5e7eb' : '#0f766e',
                      color: '#fff',
                      fontWeight: 700,
                      cursor:
                        sale.fulfillmentStatus === 'pending_review' || deliveringSaleId === sale.saleId
                          ? 'not-allowed'
                          : 'pointer',
                      opacity: deliveringSaleId === sale.saleId ? 0.7 : 1,
                    }}
                  >
                    {deliveringSaleId === sale.saleId ? 'Confirmando...' : 'Confirmar entrega'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
