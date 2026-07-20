import { useState } from 'react'
import { FiMenu } from 'react-icons/fi'
import { Outlet } from 'react-router-dom'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { siteTheme } from '../siteTheme'
import SidebarCliente from './SidebarCliente'

export default function ClienteLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isMobile = useMediaQuery(`(max-width: ${siteTheme.layout.mobileBreakpoint}px)`)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: siteTheme.colors.pageBackground }}>
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: siteTheme.colors.surfaceAlt,
            padding: '12px 14px',
            borderBottom: `1px solid ${siteTheme.colors.primarySoftBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => setIsMenuOpen((current) => !current)}
            style={{
              padding: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 20,
              color: siteTheme.colors.primary,
            }}
          >
            <FiMenu />
          </button>
          <div style={{ fontWeight: 800, fontSize: 16, color: siteTheme.colors.text }}>Minha conta</div>
          <div style={{ width: 36 }} />
        </div>
      )}

      {isMobile && isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: siteTheme.colors.overlay,
            zIndex: 40,
          }}
        />
      )}

      <SidebarCliente isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main
        style={{
          flex: 1,
          padding: isMobile ? '76px 16px 20px' : 24,
        }}
      >
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
