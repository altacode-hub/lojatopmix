import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'

export default function Logista() {
  const { user } = useAuth()
  return (
    <div>
      <h1>Área do Logista</h1>
      <div>Usuário: {user?.phoneNumber || user?.uid}</div>
      <div style={{ marginTop: 12 }}>Gestão de estoque, preços e pedidos</div>
      <div style={{ marginTop: 16 }}>
        <Link to="/logista/novo-pedido" style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8 }}>
          + Novo Pedido
        </Link>
      </div>
    </div>
  )
}
