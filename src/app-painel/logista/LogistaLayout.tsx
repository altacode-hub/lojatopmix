import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import SidebarLogista from './SidebarLogista'
import { FiMenu } from 'react-icons/fi'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaTheme } from './logistaTheme'

export default function LogistaLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: logistaTheme.colors.pageBackground }}>
      {/* Mobile Header with Hamburger Button */}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: logistaTheme.colors.surface,
            padding: 12,
            borderBottom: `1px solid ${logistaTheme.colors.accentBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: logistaTheme.shadow.card,
          }}
        >
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              padding: 8,
              border: `1px solid ${logistaTheme.colors.accentBorder}`,
              borderRadius: logistaTheme.radius.sm,
              background: logistaTheme.colors.accentSoft,
              color: logistaTheme.colors.accentDark,
              cursor: 'pointer',
              fontSize: 20,
            }}
          >
            <FiMenu />
          </button>
          <div style={{ fontWeight: 700, fontSize: 16, color: logistaTheme.colors.accentDark }}>Top Mix Store</div>
          <div style={{ width: 36 }} /> {/* Spacer */}
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobile && isMenuOpen && (
        <div
          onClick={() => setIsMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: logistaTheme.colors.overlay,
            zIndex: 40,
          }}
        />
      )}

      <SidebarLogista isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main style={{
        flex: 1,
        padding: isMobile ? '64px 16px 16px 16px' : 24,
        color: logistaTheme.colors.text,
      }}>
        <Outlet />
      </main>
    </div>
  )
}
