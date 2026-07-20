import { FiClock, FiPackage, FiTruck } from 'react-icons/fi'
import { siteTheme } from '../siteTheme'

const orderTimeline = [
  {
    id: 'PED-1208',
    date: '20/07/2026',
    status: 'Separando pedido',
    detail: 'Pagamento confirmado e itens em preparação.',
    icon: FiPackage,
  },
  {
    id: 'PED-1142',
    date: '11/07/2026',
    status: 'Em transporte',
    detail: 'Pedido saiu para entrega e está a caminho.',
    icon: FiTruck,
  },
  {
    id: 'PED-1074',
    date: '28/06/2026',
    status: 'Concluído',
    detail: 'Entrega finalizada com sucesso.',
    icon: FiClock,
  },
]

export default function ClientePedidos() {
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section
        style={{
          background: siteTheme.colors.surface,
          borderRadius: siteTheme.radius.lg,
          padding: 24,
          border: `1px solid ${siteTheme.colors.border}`,
          boxShadow: siteTheme.shadow.card,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, color: siteTheme.colors.text }}>Meus pedidos</h1>
        <p style={{ margin: '10px 0 0', color: siteTheme.colors.textMuted }}>
          Consulte o histórico, acompanhe o andamento e visualize as últimas atualizações dos seus pedidos.
        </p>
      </section>

      <section
        style={{
          display: 'grid',
          gap: 16,
        }}
      >
        {orderTimeline.map(({ id, date, status, detail, icon: Icon }) => (
          <article
            key={id}
            style={{
              background: siteTheme.colors.surface,
              borderRadius: siteTheme.radius.md,
              border: `1px solid ${siteTheme.colors.border}`,
              padding: 20,
              display: 'grid',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: siteTheme.colors.primarySoft,
                    color: siteTheme.colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: siteTheme.colors.text }}>{id}</div>
                  <div style={{ color: siteTheme.colors.textMuted, fontSize: 14 }}>Atualizado em {date}</div>
                </div>
              </div>
              <span
                style={{
                  borderRadius: siteTheme.radius.pill,
                  padding: '8px 12px',
                  background: siteTheme.colors.warningBackground,
                  color: siteTheme.colors.warningText,
                  border: `1px solid ${siteTheme.colors.warningBorder}`,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {status}
              </span>
            </div>

            <div style={{ color: siteTheme.colors.textMuted, lineHeight: 1.5 }}>{detail}</div>
          </article>
        ))}
      </section>
    </div>
  )
}
