import { useMemo } from 'react'
import { FiArrowRight, FiMapPin, FiPackage, FiPhoneCall, FiShoppingCart, FiUser } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { siteTheme } from '../siteTheme'
import { getClienteProfileDraft } from './clientStorage'

const quickAccessCards = [
  {
    title: 'Meus pedidos',
    description: 'Detalhes, status e histórico dos seus pedidos.',
    to: '/cliente/pedidos',
    icon: FiPackage,
  },
  {
    title: 'Dados cadastrais',
    description: 'Altere e gerencie seus dados cadastrais.',
    to: '/cliente/dados-cadastrais',
    icon: FiUser,
  },
  {
    title: 'Endereços',
    description: 'Cadastre ou altere seus endereços de entrega.',
    to: '/cliente/enderecos',
    icon: FiMapPin,
  },
  {
    title: 'Meu carrinho',
    description: 'Revise os produtos e siga para o pagamento.',
    to: '/cliente/carrinho',
    icon: FiShoppingCart,
  },
]

export default function ClienteHome() {
  const { user } = useAuth()
  const storageKey = user?.uid || 'anonimo'
  const greetingName = useMemo(() => {
    const profileDraft = getClienteProfileDraft(storageKey)
    return profileDraft.fullName.trim() || user?.phoneNumber || 'cliente'
  }, [storageKey, user?.phoneNumber])

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <section
        style={{
          background: siteTheme.colors.surface,
          borderRadius: siteTheme.radius.lg,
          padding: '24px 24px 22px',
          boxShadow: siteTheme.shadow.card,
          border: `1px solid ${siteTheme.colors.border}`,
        }}
      >
        <div style={{ color: siteTheme.colors.primary, fontSize: 15, fontWeight: 700 }}>Minha conta</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 22, color: siteTheme.colors.text }}>Olá, {greetingName}.</h1>
        <p style={{ margin: 0, color: siteTheme.colors.textMuted, maxWidth: 720 }}>
          Acompanhe seus pedidos, atualize seu cadastro, organize seus endereços e finalize compras com mais rapidez.
        </p>
      </section>

      <section>
        <div
          style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          {quickAccessCards.map(({ title, description, to, icon: Icon }) => (
            <Link
              key={title}
              to={to}
              style={{
                background: siteTheme.colors.surface,
                borderRadius: siteTheme.radius.md,
                border: `1px solid ${siteTheme.colors.primary}`,
                padding: '22px 20px',
                textDecoration: 'none',
                color: siteTheme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                minHeight: 118,
                boxShadow: '0 12px 30px rgba(17, 24, 39, 0.05)',
              }}
            >
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: siteTheme.colors.primary,
                  background: siteTheme.colors.primarySoft,
                  flexShrink: 0,
                }}
              >
                <Icon size={28} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: siteTheme.colors.primary }}>{title}</div>
                <div style={{ marginTop: 6, color: siteTheme.colors.textMuted, lineHeight: 1.45 }}>{description}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        style={{
          background: siteTheme.colors.surface,
          borderRadius: siteTheme.radius.lg,
          padding: '24px 24px 28px',
          borderTop: `1px solid ${siteTheme.colors.divider}`,
          borderBottom: `1px solid ${siteTheme.colors.divider}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: siteTheme.colors.primary }}>
          <FiPhoneCall size={22} />
          <h2 style={{ margin: 0, fontSize: 22 }}>Atendimento</h2>
        </div>
        <p style={{ margin: '14px 0 0', color: siteTheme.colors.textMuted, maxWidth: 820, lineHeight: 1.5 }}>
          Se você estiver com dúvidas sobre entregas, pagamentos ou cadastro, consulte os canais oficiais informados nas
          páginas institucionais da loja.
        </p>
        <Link
          to="/politicaPrivacidade"
          style={{
            marginTop: 22,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: siteTheme.colors.primary,
            color: siteTheme.colors.surface,
            borderRadius: 12,
            padding: '12px 18px',
            textDecoration: 'none',
            fontWeight: 700,
          }}
        >
          Ir para atendimento
          <FiArrowRight size={16} />
        </Link>
      </section>
    </div>
  )
}
