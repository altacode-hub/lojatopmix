import { useAuth } from '../context/AuthContext'

export default function Cliente() {
  const { user } = useAuth()
  return (
    <div style={{ padding: 24 }}>
      <h1>Área do Cliente</h1>
      <div>Usuário: {user?.phoneNumber || user?.uid}</div>
      <div>Usuário: {user?.uid}</div>
    </div>
  )
}
