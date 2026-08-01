import {
  FiHome,
  FiLogOut,
  FiMapPin,
  FiPackage,
  FiShoppingCart,
  FiUser,
} from 'react-icons/fi'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { siteTheme } from '../siteTheme'
import { IoStorefrontOutline } from 'react-icons/io5'

interface SidebarClienteProps {
  isOpen: boolean
  onClose: () => void
}

const navLinkStyle = (active: boolean) => ({
  padding: '10px 12px',
  borderRadius: siteTheme.radius.sm,
  textDecoration: 'none',
  color: siteTheme.colors.text,
  background: active ? siteTheme.colors.primarySoft : 'transparent',
  border: `1px solid ${active ? siteTheme.colors.primarySoftBorder : 'transparent'}`,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  textAlign: 'left' as const,
})

export default function SidebarCliente({ isOpen, onClose }: SidebarClienteProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery(`(max-width: ${siteTheme.layout.mobileBreakpoint}px)`)

  const isActive = (path: string) => location.pathname === path
  const startsWith = (path: string) => location.pathname.startsWith(path)

  const handleNavigate = () => {
    if (isMobile) {
      onClose()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      style={{
        width: isMobile ? (isOpen ? siteTheme.layout.sidebarWidth : 0) : siteTheme.layout.sidebarWidth,
        background: siteTheme.colors.surfaceAlt,
        borderRight: isMobile
          ? isOpen
            ? `1px solid ${siteTheme.colors.primarySoftBorder}`
            : 'none'
          : `1px solid ${siteTheme.colors.primarySoftBorder}`,
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? (isOpen ? 18 : 0) : 18,
        maxHeight: '100vh',
        minHeight: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: isMobile ? (isOpen ? 0 : -siteTheme.layout.sidebarWidth) : 0,
        zIndex: isMobile ? 60 : 0,
        alignItems: 'flex-start',
        overflow: isMobile ? (isOpen ? 'auto' : 'hidden') : 'auto',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          display: isMobile && !isOpen ? 'none' : 'block',
          marginBottom: 20,
          textAlign: 'left',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 20, color: siteTheme.colors.primary }}>Top Mix</div>
        <div style={{ color: siteTheme.colors.textMuted, fontSize: 12, marginTop: 4 }}>Área do Cliente</div>
      </div>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          opacity: isMobile && !isOpen ? 0 : 1,
          pointerEvents: isMobile && !isOpen ? 'none' : 'auto',
        }}
      >
        <Link to="/" style={navLinkStyle(isActive('/'))}>
          <IoStorefrontOutline size={18} />
          {(!isMobile || isOpen) && <span>Ir para loja</span>} 
        </Link>
        
        <Link to="/cliente" onClick={handleNavigate} style={navLinkStyle(isActive('/cliente'))}>
          <FiHome size={18} />
          {(!isMobile || isOpen) && <span>Minha conta</span>}
        </Link>

        <Link
          to="/cliente/carrinho"
          onClick={handleNavigate}
          style={navLinkStyle(startsWith('/cliente/carrinho') || startsWith('/cliente/checkout'))}
        >
          <FiShoppingCart size={18} />
          {(!isMobile || isOpen) && <span>Meu carrinho</span>}
        </Link>

        <Link to="/cliente/pedidos" onClick={handleNavigate} style={navLinkStyle(startsWith('/cliente/pedidos'))}>
          <FiPackage size={18} />
          {(!isMobile || isOpen) && <span>Meus pedidos</span>}
        </Link>

        <Link
          to="/cliente/dados-cadastrais"
          onClick={handleNavigate}
          style={navLinkStyle(startsWith('/cliente/dados-cadastrais'))}
        >
          <FiUser size={18} />
          {(!isMobile || isOpen) && <span>Dados cadastrais</span>}
        </Link>

        <Link to="/cliente/enderecos" onClick={handleNavigate} style={navLinkStyle(startsWith('/cliente/enderecos'))}>
          <FiMapPin size={18} />
          {(!isMobile || isOpen) && <span>Endereços</span>}
        </Link>

      </nav>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 25,
          width: '100%',
          opacity: isMobile && !isOpen ? 0 : 1,
          pointerEvents: isMobile && !isOpen ? 'none' : 'auto',
        }}
      >
        <div style={{ fontSize: 12, color: siteTheme.colors.textMuted, marginBottom: 6 }}>Logado com</div>
        <div style={{ fontSize: 14, marginBottom: 12, wordBreak: 'break-all', color: siteTheme.colors.text }}>
          {user?.phoneNumber || user?.uid}
        </div>

        <button
          onClick={() => void handleSignOut()}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: siteTheme.radius.sm,
            border: `1px solid ${siteTheme.colors.border}`,
            background: siteTheme.colors.surface,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'flex-start',
            color: siteTheme.colors.text,
          }}
        >
          <FiLogOut size={18} />
          {(!isMobile || isOpen) && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
