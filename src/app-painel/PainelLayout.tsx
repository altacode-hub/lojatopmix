import { Link, Outlet } from 'react-router-dom'
import { logistaTheme } from './logista/logistaTheme'

export default function PainelLayout() {
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: logistaTheme.colors.pageBackground, display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: logistaTheme.colors.surface,
        borderBottom: `1px solid ${logistaTheme.colors.border}`,
        padding: '16px 24px',
      }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: logistaTheme.colors.accentDark }}>
            Top Mix Painel
          </div>
          <nav style={{ display: 'flex', gap: 16 }}>
            <Link to="/login" style={{ color: logistaTheme.colors.accentDark, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
              Login
            </Link>
            <Link to="/termodeuso" style={{ color: logistaTheme.colors.text, textDecoration: 'none', fontSize: 14 }}>
              Termos
            </Link>
            <Link to="/politicaPrivacidade" style={{ color: logistaTheme.colors.text, textDecoration: 'none', fontSize: 14 }}>
              Privacidade
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{ background: logistaTheme.colors.surface, borderTop: `1px solid ${logistaTheme.colors.border}`, color: logistaTheme.colors.textMuted, marginTop: 'auto' }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '16px 24px' }}>
          <div>© {new Date().getFullYear()} Top Mix Painel</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/politicaPrivacidade" style={{ color: logistaTheme.colors.textMuted, textDecoration: 'none' }}>
              Política de Privacidade
            </Link>
            <span style={{ opacity: 0.5 }}>•</span>
            <Link to="/termodeuso" style={{ color: logistaTheme.colors.textMuted, textDecoration: 'none' }}>
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
