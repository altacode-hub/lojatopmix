import { FiBookmark } from 'react-icons/fi'
import { cardStyle, formatCurrency, formatDateTime, getStatusMeta } from './helpers'
import type { ReservedSaleViewRecord } from './types'
import { logistaTheme } from '../logistaTheme'

type ReservedSalesSectionProps = {
  reservedSales: ReservedSaleViewRecord[]
  onOpenPayment: (sale: ReservedSaleViewRecord) => void
  onCancelReservation: (sale: ReservedSaleViewRecord) => void
  cancellingReservationId: string | null
}

export default function ReservedSalesSection({
  reservedSales,
  onOpenPayment,
  onCancelReservation,
  cancellingReservationId,
}: ReservedSalesSectionProps) {
  return (
    <section style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiBookmark size={18} />
          <h2 style={{ margin: 0, fontSize: 24 }}>Vendas reservadas</h2>
        </div>
        <div style={{ color: logistaTheme.colors.textMuted }}>
          Reservas de balcao e compras online aguardando entrega aparecem aqui para dar visao ampla ao logista.
        </div>
      </div>

      {reservedSales.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 14,
            background: logistaTheme.colors.surfaceAlt,
            color: logistaTheme.colors.textMuted,
          }}
        >
          Nenhuma reserva de balcao ou compra online pendente no momento.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {reservedSales.map((sale) => {
            const statusMeta = getStatusMeta(sale)
            const isOnlineSale = sale.channel === 'online'
            const isCartReservation = sale.sourceType === 'cart'
            const canOpenPayment = !isOnlineSale && !isCartReservation && sale.paymentStatus !== 'paid'
            const canCancelReservation = !isOnlineSale && sale.stockStatus === 'reserved'
            const saleTitle = isCartReservation
              ? 'Reserva do carrinho'
              : sale.customer?.name || (isOnlineSale ? 'Cliente do site' : 'Reserva de balcao')
            const saleIdentifier = isCartReservation ? sale.cartId || sale.saleId : isOnlineSale ? sale.orderNsu || sale.saleId : sale.saleId
            const saleDateLabel = isOnlineSale ? 'Criada em' : 'Reservada em'
            const saleNote = isOnlineSale
              ? 'Pagamento aprovado no site. Use a secao de entregas online para separar e concluir a entrega.'
              : isCartReservation
                ? sale.notes || 'Produtos reservados no carrinho do cliente aguardando checkout.'
              : sale.notes || 'Aguardando definicao da forma de pagamento.'
            const reservationChannelLabel = isOnlineSale ? 'Compra online' : isCartReservation ? 'Carrinho' : 'Balcao'
            const isCancelling = cancellingReservationId === sale.saleId

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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong>{saleTitle}</strong>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: logistaTheme.colors.accentSoft,
                          color: logistaTheme.colors.accentDark,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {reservationChannelLabel}
                      </span>
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
                      {isOnlineSale ? 'Pedido' : isCartReservation ? 'Carrinho' : 'Codigo'}: {saleIdentifier} • {saleDateLabel}{' '}
                      {formatDateTime(sale.reservedAt || sale.createdAt)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: logistaTheme.colors.text }}>{formatCurrency(sale.totalAmount)}</div>
                    <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>{sale.totalItems} item(ns)</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {(sale.items || []).map((item, index) => (
                    <div
                      key={`${sale.saleId}-reserved-${index}`}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ color: logistaTheme.colors.textMuted, fontSize: 14 }}>{saleNote}</div>

                  {canCancelReservation || canOpenPayment ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {canCancelReservation ? (
                        <button
                          onClick={() => onCancelReservation(sale)}
                          disabled={isCancelling}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            border: `1px solid ${logistaTheme.colors.errorBorder}`,
                            background: logistaTheme.colors.errorBackground,
                            color: logistaTheme.colors.errorText,
                            fontWeight: 700,
                            cursor: isCancelling ? 'not-allowed' : 'pointer',
                            opacity: isCancelling ? 0.7 : 1,
                          }}
                        >
                          {isCancelling ? 'Cancelando...' : 'Cancelar reserva'}
                        </button>
                      ) : null}

                      {canOpenPayment ? (
                        <button
                          onClick={() => onOpenPayment(sale)}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 12,
                            border: 'none',
                            background: logistaTheme.colors.accent,
                            color: logistaTheme.colors.surface,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Ir para pagamento
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
