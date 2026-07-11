import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function SidebarLogista() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => location.pathname === path

  const sair = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      style={{
        width: 240,
        background: '#fdf2f8',
        borderRight: '1px solid #f3e8ff',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Top Mix Store</div>
      <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 16 }}>Área do Logista</div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link
          to="/logista"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            textDecoration: 'none',
            color: '#111827',
            background: isActive('/logista') ? '#fae8ff' : 'transparent',
            border: isActive('/logista') ? '1px solid #e9d5ff' : '1px solid transparent',
          }}
        >
          🏠 Dashboard
        </Link>
        <Link
          to="/logista/novo-pedido"
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            textDecoration: 'none',
            color: '#111827',
            background: isActive('/logista/novo-pedido') ? '#fae8ff' : 'transparent',
            border: isActive('/logista/novo-pedido') ? '1px solid #e9d5ff' : '1px solid transparent',
          }}
        >
          ➕ Novo Pedido
        </Link>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: '#6b7280',
            border: '1px dashed #f3e8ff',
          }}
          title="Em breve"
        >
          🕒 Histórico
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: '#6b7280',
            border: '1px dashed #f3e8ff',
          }}
          title="Em breve"
        >
          🏷️ Categorias
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            color: '#6b7280',
            border: '1px dashed #f3e8ff',
          }}
          title="Em breve"
        >
          ❓ Como Funciona
        </div>
      </nav>

      <div style={{ marginTop: 'auto' }}>
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
          }}
        >
          ↩️ Sair
        </button>
      </div>
    </aside>
  )
}
