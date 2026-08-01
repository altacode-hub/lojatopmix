import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FiHome, FiPlusSquare, FiClock, FiTag, FiHelpCircle, FiLogOut, FiShoppingCart, FiPackage } from 'react-icons/fi'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { logistaTheme } from './logistaTheme'

interface SidebarLogistaProps {
  isOpen: boolean
  onClose: () => void
}

export default function SidebarLogista({ isOpen, onClose }: SidebarLogistaProps) {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')

  const isActive = (path: string) => location.pathname === path

  const sair = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleLinkClick = () => {
    if (isMobile) {
      onClose()
    }
  }

  const getLinkStyle = (active: boolean) => ({
    padding: '10px 12px',
    borderRadius: 10,
    textDecoration: 'none',
    color: active ? logistaTheme.colors.accentDark : logistaTheme.colors.text,
    background: active ? logistaTheme.colors.accentSoft : 'transparent',
    border: active ? `1px solid ${logistaTheme.colors.accentBorder}` : '1px solid transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    textAlign: 'left' as const,
  })

  return (
    <aside
      style={{
        width: isMobile ? (isOpen ? 240 : 0) : 240,
        background: logistaTheme.colors.surfaceAlt,
        borderRight: isMobile
          ? (isOpen ? `1px solid ${logistaTheme.colors.accentBorder}` : 'none')
          : `1px solid ${logistaTheme.colors.accentBorder}`,
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? (isOpen ? 16 : 0) : 16,
        minHeight: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: isMobile ? 0 : 0,
        left: isMobile ? (isOpen ? 0 : -240) : 0,
        zIndex: isMobile ? 60 : 0,
        alignItems: 'flex-start',
        overflow: isMobile ? (isOpen ? 'auto' : 'hidden') : 'auto',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{
        fontWeight: 700,
        fontSize: 18,
        marginBottom: 8,
        textAlign: 'left',
        display: isMobile && !isOpen ? 'none' : 'block',
        color: logistaTheme.colors.accentDark,
      }}>Top Mix Store</div>
      <div style={{
        color: logistaTheme.colors.textMuted,
        fontSize: 12,
        marginBottom: 16,
        textAlign: 'left',
        display: isMobile && !isOpen ? 'none' : 'block',
      }}>Área do Logista</div>

      <nav style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        opacity: isMobile && !isOpen ? 0 : 1,
        pointerEvents: isMobile && !isOpen ? 'none' : 'auto',
      }}>
        <Link
          to="/"
          onClick={handleLinkClick}
          style={getLinkStyle(isActive('/'))}
        >
          <FiHome size={18} />
          {(!isMobile || isOpen) && <span>Dashboard</span>}
        </Link>
        <Link
          to="/vendas"
          onClick={handleLinkClick}
          style={getLinkStyle(location.pathname.startsWith('/vendas'))}
        >
          <FiShoppingCart size={18} />
          {(!isMobile || isOpen) && <span>Vendas</span>}
        </Link>
        <Link
          to="/novo-pedido"
          onClick={handleLinkClick}
          style={getLinkStyle(isActive('/novo-pedido'))}
        >
          <FiPlusSquare size={18} />
          {(!isMobile || isOpen) && <span>Novo Pedido</span>}
        </Link>
        <Link
          to="/estoque"
          onClick={handleLinkClick}
          style={getLinkStyle(location.pathname.startsWith('/estoque'))}
        >
          <FiPackage size={18} />
          {(!isMobile || isOpen) && <span>Estoque</span>}
        </Link>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: logistaTheme.colors.textMuted,
            border: `1px dashed ${logistaTheme.colors.accentBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
          title="Em breve"
        >
          <FiClock size={18} />
          {(!isMobile || isOpen) && <span>Histórico</span>}
        </div>
        <Link
          to="/categorias"
          onClick={handleLinkClick}
          style={getLinkStyle(location.pathname.startsWith('/categorias'))}
        >
          <FiTag size={18} />
          {(!isMobile || isOpen) && <span>Categorias</span>}
        </Link>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: logistaTheme.colors.textMuted,
            border: `1px dashed ${logistaTheme.colors.accentBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
          title="Em breve"
        >
          <FiHelpCircle size={18} />
          {(!isMobile || isOpen) && <span>Como Funciona</span>}
        </div>
      </nav>

      <div style={{
        marginTop: 'auto',
        width: '100%',
        textAlign: 'left',
        opacity: isMobile && !isOpen ? 0 : 1,
        pointerEvents: isMobile && !isOpen ? 'none' : 'auto',
      }}>
        <div style={{ fontSize: 12, color: logistaTheme.colors.textMuted, marginBottom: 6 }}>Logado como:</div>
        <div style={{ fontSize: 14, marginBottom: 8, wordBreak: 'break-all', color: logistaTheme.colors.text }}>
          {user?.phoneNumber || user?.uid}
        </div>
        <button
          onClick={sair}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${logistaTheme.colors.border}`,
            background: logistaTheme.colors.surface,
            color: logistaTheme.colors.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'flex-start',
          }}
        >
          <FiLogOut size={18} />
          {(!isMobile || isOpen) && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
