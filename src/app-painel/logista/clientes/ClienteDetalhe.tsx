import type { Dispatch, SetStateAction } from 'react'
import { FiDollarSign, FiShoppingCart, FiUser, FiXSquare } from 'react-icons/fi'
import { logistaInputStyle, logistaTheme } from '../logistaTheme'
import { cardStyle, formatCurrency, formatDateTime } from '../vendas/helpers'
import type { AmortizationRecord, CustomerRecord, SaleRecord } from '../vendas/types'

type CustomerView = CustomerRecord & {
  computedDebt: number
  computedPurchased: number
  computedPaid: number
}

type NewAmortizationState = {
  saleId: string
  amountText: string
  paymentMethod: string
  notes: string
}

type ClienteDetalheProps = {
  isMobile: boolean
  detailCustomer: CustomerView | null
  customerSales: SaleRecord[]
  customerAmortizations: AmortizationRecord[]
  savingAmortization: string | null
  newAmortization: NewAmortizationState
  setNewAmortization: Dispatch<SetStateAction<NewAmortizationState>>
  handleRegisterAmortization: () => Promise<void>
  getSaleRemainingDebt: (sale: SaleRecord) => number
}

export default function ClienteDetalhe({
  isMobile,
  detailCustomer,
  customerSales,
  customerAmortizations,
  savingAmortization,
  newAmortization,
  setNewAmortization,
  handleRegisterAmortization,
  getSaleRemainingDebt,
}: ClienteDetalheProps) {
  if (!detailCustomer) return null

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ ...cardStyle, display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: logistaTheme.colors.accentSoft,
              color: logistaTheme.colors.accentDark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 24,
              flex: '0 0 auto',
            }}
          >
            {detailCustomer.name?.charAt(0).toUpperCase() || <FiUser size={28} />}
          </div>
          <div style={{ minWidth: 0, flex: '1 1 240px' }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{detailCustomer.name}</h2>
            {detailCustomer.phone_number ? (
              <div style={{ color: logistaTheme.colors.textMuted, marginTop: 4 }}>
                📞 {detailCustomer.phone_number}
              </div>
            ) : null}
            {detailCustomer.birthDate ? (
              <div style={{ color: logistaTheme.colors.textMuted, marginTop: 2 }}>
                🎂 Nascimento: {detailCustomer.birthDate}
              </div>
            ) : null}
            {detailCustomer.email ? (
              <div style={{ color: logistaTheme.colors.textMuted, marginTop: 2 }}>
                ✉️ {detailCustomer.email}
              </div>
            ) : null}
            {detailCustomer.notes ? (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 10,
                  background: logistaTheme.colors.surfaceAlt,
                  border: `1px dashed ${logistaTheme.colors.border}`,
                  fontSize: 13,
                  color: logistaTheme.colors.textMuted,
                }}
              >
                <strong style={{ color: logistaTheme.colors.text }}>Obs.:</strong> {detailCustomer.notes}
              </div>
            ) : null}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              minWidth: isMobile ? '100%' : 360,
            }}
          >
            <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${logistaTheme.colors.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>Total comprado</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{formatCurrency(detailCustomer.computedPurchased)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: `1px solid ${logistaTheme.colors.successBorder}`, background: logistaTheme.colors.successBackground, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: logistaTheme.colors.successText }}>Total pago</div>
              <div style={{ fontWeight: 800, marginTop: 4, color: logistaTheme.colors.successText }}>
                {formatCurrency(detailCustomer.computedPaid)}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningBorder : logistaTheme.colors.successBorder}`,
                background: detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningBackground : logistaTheme.colors.successBackground,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 12, color: detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText }}>
                {detailCustomer.computedDebt > 0 ? 'Devendo' : 'Quitado'}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  marginTop: 4,
                  color: detailCustomer.computedDebt > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText,
                }}
              >
                {formatCurrency(detailCustomer.computedDebt)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {customerSales.some((s) => getSaleRemainingDebt(s) > 0) ? (
        <section
          style={{
            ...cardStyle,
            display: 'grid',
            gap: 14,
            border: `1px solid ${logistaTheme.colors.infoBorder ?? logistaTheme.colors.accentBorder}`,
            background: logistaTheme.colors.infoBackground ?? logistaTheme.colors.accentSoft,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FiDollarSign size={18} />
            <h3 style={{ margin: 0, fontSize: 18 }}>Registrar pagamento (amortização)</h3>
          </div>

          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>
                Venda em aberto <span style={{ color: logistaTheme.colors.errorText }}>*</span>
              </span>
              <select
                value={newAmortization.saleId}
                onChange={(e) => setNewAmortization((s) => ({ ...s, saleId: e.target.value }))}
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              >
                <option value="">Selecione a venda...</option>
                {customerSales
                  .filter((s) => getSaleRemainingDebt(s) > 0)
                  .map((s) => (
                    <option key={s.saleId} value={s.saleId}>
                      {formatDateTime(s.createdAt)} • {formatCurrency(getSaleRemainingDebt(s))} em aberto • {s.totalItems || 0} itens
                    </option>
                  ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>
                Valor do pagamento R$ <span style={{ color: logistaTheme.colors.errorText }}>*</span>
              </span>
              <input
                value={newAmortization.amountText}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  const reais = digits ? Number(digits) / 100 : 0
                  setNewAmortization((s) => ({
                    ...s,
                    amountText: reais > 0 ? formatCurrency(reais).replace('R$', '').trim() : '',
                  }))
                }}
                placeholder="R$ 0,00"
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Forma de pagamento</span>
              <select
                value={newAmortization.paymentMethod}
                onChange={(e) => setNewAmortization((s) => ({ ...s, paymentMethod: e.target.value }))}
                style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">Pix</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="transferencia">Transferência</option>
                <option value="boleto">Boleto</option>
                <option value="outro">Outro</option>
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 13, color: logistaTheme.colors.text }}>Observação (opcional)</span>
            <input
              value={newAmortization.notes}
              onChange={(e) => setNewAmortization((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Ex.: Pago em dinheiro no balcão"
              style={{ ...logistaInputStyle, width: '100%', boxSizing: 'border-box' }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => void handleRegisterAmortization()}
              disabled={!!savingAmortization}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                border: 'none',
                background: logistaTheme.colors.successText ?? logistaTheme.colors.accent,
                color: logistaTheme.colors.surface,
                fontWeight: 700,
                cursor: savingAmortization ? 'not-allowed' : 'pointer',
                opacity: savingAmortization ? 0.7 : 1,
              }}
            >
              {savingAmortization ? 'Registrando...' : '✓ Registrar pagamento'}
            </button>
          </div>
        </section>
      ) : null}

      <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiShoppingCart size={18} />
          <h3 style={{ margin: 0, fontSize: 18 }}>Compras do cliente</h3>
        </div>
        {customerSales.length === 0 ? (
          <div style={{ color: logistaTheme.colors.textMuted }}>Este cliente ainda não possui compras registradas.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {customerSales.map((s) => {
              const remaining = getSaleRemainingDebt(s)
              const isAmort = s.paymentMethod === 'amortizacao'
              return (
                <div
                  key={s.saleId}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${logistaTheme.colors.border}`,
                    display: 'grid',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {s.channel === 'balcao' ? 'Venda no balcão' : s.channel === 'online' ? 'Compra online' : s.channel} •{' '}
                        <span style={{ color: logistaTheme.colors.textMuted, fontWeight: 500 }}>
                          {formatDateTime(s.createdAt)}
                        </span>
                      </div>
                      <div style={{ color: logistaTheme.colors.textMuted, fontSize: 13 }}>
                        {s.totalItems || 0} item(ns) • Código: {s.saleId}
                      </div>
                      {isAmort ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              background: logistaTheme.colors.accentSoft,
                              color: logistaTheme.colors.accentDark,
                              border: `1px solid ${logistaTheme.colors.accentBorder}`,
                            }}
                          >
                            Pagamento por amortização
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 12,
                              background: remaining > 0 ? logistaTheme.colors.warningBackground : logistaTheme.colors.successBackground,
                              color: remaining > 0 ? logistaTheme.colors.warningText : logistaTheme.colors.successText,
                              border: `1px solid ${remaining > 0 ? logistaTheme.colors.warningBorder : logistaTheme.colors.successBorder}`,
                            }}
                          >
                            {remaining > 0 ? `Em aberto: ${formatCurrency(remaining)}` : 'Quitada'}
                          </span>
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            marginTop: 6,
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: 12,
                            background: logistaTheme.colors.successBackground,
                            color: logistaTheme.colors.successText,
                            border: `1px solid ${logistaTheme.colors.successBorder}`,
                          }}
                        >
                          Pago integralmente
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>Total da venda</div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{formatCurrency(Number(s.totalAmount || 0))}</div>
                      {isAmort ? (
                        <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted, marginTop: 4 }}>
                          Pago: <strong style={{ color: logistaTheme.colors.successText }}>{formatCurrency(Number(s.paidAmount || 0))}</strong>
                          {' / '}
                          Restante: <strong style={{ color: logistaTheme.colors.warningText }}>{formatCurrency(remaining)}</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {s.notes ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: logistaTheme.colors.textMuted,
                        padding: 8,
                        borderRadius: 8,
                        background: logistaTheme.colors.surfaceAlt,
                      }}
                    >
                      📝 {s.notes}
                    </div>
                  ) : null}

                  <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
                    {s.items?.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <span>
                          • {it.productName}
                          {it.size || it.color ? ` (${it.size || '-'}${it.color ? ` • ${it.color}` : ''})` : ''}
                          {it.quantity > 1 ? ` ×${it.quantity}` : ''}
                        </span>
                        <span style={{ color: logistaTheme.colors.textMuted }}>{formatCurrency(Number(it.lineTotal || 0))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FiXSquare size={18} />
          <h3 style={{ margin: 0, fontSize: 18 }}>Histórico de pagamentos (amortizações)</h3>
        </div>
        {customerAmortizations.length === 0 ? (
          <div style={{ color: logistaTheme.colors.textMuted }}>
            Nenhum pagamento por amortização registrado para este cliente.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 1fr 1fr 1fr',
                gap: 10,
                fontSize: 12,
                color: logistaTheme.colors.textMuted,
                fontWeight: 700,
                padding: '0 8px',
              }}
            >
              <span>Data</span>
              <span>Venda</span>
              <span style={{ textAlign: isMobile ? 'right' : 'center' }}>Forma</span>
              <span style={{ textAlign: 'right' }}>Valor</span>
            </div>
            {customerAmortizations.map((a) => (
              <div
                key={a.amortizationId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 1fr 1fr 1fr',
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${logistaTheme.colors.border}`,
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 13 }}>{formatDateTime(a.createdAt)}</div>
                <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted }}>
                  #{a.saleId?.slice(-6) || '-'}
                </div>
                <div style={{ textAlign: isMobile ? 'right' : 'center', fontSize: 13, textTransform: 'capitalize' }}>
                  {a.paymentMethod?.replace('_', ' ') || 'dinheiro'}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 800, color: logistaTheme.colors.successText }}>
                  + {formatCurrency(Number(a.amount || 0))}
                </div>
                {a.notes ? (
                  <div style={{ gridColumn: '1 / -1', fontSize: 12, color: logistaTheme.colors.textMuted }}>
                    📝 {a.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
