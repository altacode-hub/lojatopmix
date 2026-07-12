import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import SidebarLogista from './SidebarLogista'
import { FiMenu } from 'react-icons/fi'
import { useMediaQuery } from '../../hooks/useMediaQuery'

export default function LogistaLayout() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile Header with Hamburger Button */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: '#fdf2f8',
          padding: 12,
          borderBottom: '1px solid #f3e8ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              padding: 8,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 20
            }}
          >
            <FiMenu />
          </button>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Top Mix Store</div>
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
            background: 'rgba(0,0,0,0.5)',
            zIndex: 40,
          }}
        />
      )}

      <SidebarLogista isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <main style={{ 
        flex: 1, 
        padding: isMobile ? '64px 16px 16px 16px' : 24,
      }}>
        <Outlet />
      </main>
    </div>
  )
}
