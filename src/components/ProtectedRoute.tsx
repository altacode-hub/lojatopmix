import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { JSX } from 'react'
import PainelLoading from '../app-painel/PainelLoading'

type ProtectedRouteProps = {
  children: JSX.Element
  requireLogista?: boolean
  requireCliente?: boolean
}

export default function ProtectedRoute({
  children,
  requireLogista = false,
  requireCliente = false,
}: ProtectedRouteProps) {
  const { user, loading, isLogista, isCliente } = useAuth()
  if (loading || isLogista === undefined) return <PainelLoading />
  if (!user) return <Navigate to="/login" replace />
  if (requireLogista && !isLogista) {
    return <Navigate to="/login" replace />
  }
  if (requireCliente && !isCliente) {
    return <Navigate to="/login" replace />
  }
  return children
}
