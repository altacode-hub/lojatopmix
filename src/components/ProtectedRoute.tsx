import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { JSX } from 'react'

type ProtectedRouteProps = {
  children: JSX.Element
  requireLogista?: boolean
}

export default function ProtectedRoute({ children, requireLogista = false }: ProtectedRouteProps) {
  const { user, loading, isLogista, profileLoading } = useAuth()
  if (loading || profileLoading) return <div>Carregando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (requireLogista && !isLogista) return <Navigate to="/cliente" replace />
  return children
}
