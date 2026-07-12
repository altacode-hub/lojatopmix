import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FiHome, FiPlusSquare, FiClock, FiTag, FiHelpCircle, FiLogOut } from 'react-icons/fi'
import { useMediaQuery } from '../../hooks/useMediaQuery'

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

  return (
    <aside
      style={{
        width: isMobile ? (isOpen ? 240 : 0) : 240,
        background: '#fdf2f8',
        borderRight: isMobile ? (isOpen ? '1px solid #f3e8ff' : 'none') : '1px solid #f3e8ff',
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
        display: isMobile && !isOpen ? 'none' : 'block'
      }}>Top Mix Store</div>
      <div style={{ 
        color: '#6b7280', 
        fontSize: 12, 
        marginBottom: 16, 
        textAlign: 'left',
        display: isMobile && !isOpen ? 'none' : 'block'
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
          to="/logista"
          onClick={handleLinkClick}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            textDecoration: 'none',
            color: '#111827',
            background: isActive('/logista') ? '#fae8ff' : 'transparent',
            border: isActive('/logista') ? '1px solid #e9d5ff' : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
        >
          <FiHome size={18} />
          {(!isMobile || isOpen) && <span>Dashboard</span>}
        </Link>
        <Link
          to="/logista/novo-pedido"
          onClick={handleLinkClick}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            textDecoration: 'none',
            color: '#111827',
            background: isActive('/logista/novo-pedido') ? '#fae8ff' : 'transparent',
            border: isActive('/logista/novo-pedido') ? '1px solid #e9d5ff' : '1px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
        >
          <FiPlusSquare size={18} />
          {(!isMobile || isOpen) && <span>Novo Pedido</span>}
        </Link>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: '#6b7280',
            border: '1px dashed #f3e8ff',
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
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: '#6b7280',
            border: '1px dashed #f3e8ff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textAlign: 'left',
          }}
          title="Em breve"
        >
          <FiTag size={18} />
          {(!isMobile || isOpen) && <span>Categorias</span>}
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: '#6b7280',
            border: '1px dashed #f3e8ff',
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
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Logado como:</div>
        <div style={{ fontSize: 14, marginBottom: 8, wordBreak: 'break-all' }}>
          {user?.phoneNumber || user?.uid}
        </div>
        <button
          onClick={sair}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: '#fff',
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
