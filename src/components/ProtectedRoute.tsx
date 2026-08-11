import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { JSX } from 'react'
import PainelLoading from '../app-painel/PainelLoading'

const CLIENTE_APP_URL = 'https://lojatopmix.web.app'

function RedirectToCliente() {
  useEffect(() => {
    window.location.href = CLIENTE_APP_URL
  }, [])
  return <PainelLoading />
}

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
    return <RedirectToCliente />
  }
  if (requireCliente && !isCliente) {
    return <Navigate to="/login" replace />
  }
  return children
}
