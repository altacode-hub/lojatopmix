import { useAuth } from '../context/AuthContext'

export default function Logista() {
  const { user } = useAuth()
  return (
    <div style={{ padding: 24 }}>
      <h1>Área do Logista</h1>
      <div>Usuário: {user?.phoneNumber || user?.uid}</div>
      <div style={{ marginTop: 12 }}>Gestão de estoque, preços e pedidos</div>
    </div>
  )
}
