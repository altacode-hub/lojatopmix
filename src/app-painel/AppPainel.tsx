import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import LogistaLayout from './logista/LogistaLayout'
import { logistaRoutes } from './logista/LogistaRoutes'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../context/AuthContext'
import LoginPainel from './LoginPainel'
import TermoDeUsoPainel from './TermoDeUsoPainel'
import PoliticaPrivacidadePainel from './PoliticaPrivacidadePainel'
import PainelLayout from './PainelLayout'
import DebugAuth from './DebugAuth'
import PainelLoading from './PainelLoading'
import '../App.css'

const CLIENTE_APP_URL = 'https://lojatopmix.web.app'

function RedirectToCliente() {
  useEffect(() => {
    window.location.href = CLIENTE_APP_URL
  }, [])
  return <PainelLoading />
}

function FallbackRoute() {
  const { user, loading, isLogista, isCliente, profileLoading } = useAuth()

  if (loading || profileLoading) {
    console.log('[AppPainel FallbackRoute] ⏳ Aguardando carregamento...', { loading, profileLoading })
    return <PainelLoading />
  }
  if (!user) {
    console.log('[AppPainel FallbackRoute] 👤 Nenhum usuário logado → indo para /login')
    return <Navigate to="/login" replace />
  }
  if (isCliente && !isLogista) {
    console.log('[AppPainel FallbackRoute] 🛒 É cliente (não logista) → redirecionando para lojatopmix.web.app', { isCliente, isLogista })
    return <RedirectToCliente />
  }
  if (!isLogista) {
    console.log('[AppPainel FallbackRoute] 🚫 Usuário logado mas isLogista=false → redirecionando para app cliente', {
      uid: user.uid, isCliente, isLogista
    })
    return <RedirectToCliente />
  }
  console.log('[AppPainel FallbackRoute] ✅ Usuário logista confirmado → indo para home /')
  return <Navigate to="/" replace />
}

export default function AppPainel() {
  return (
    <div>
      <Routes>
        <Route element={<PainelLayout />}>
          <Route path="/login" element={<LoginPainel />} />
          <Route path="/termodeuso" element={<TermoDeUsoPainel />} />
          <Route path="/politicaPrivacidade" element={<PoliticaPrivacidadePainel />} />
          <Route path="/debug" element={<DebugAuth />} />
        </Route>
        <Route
          path="/"
          element={
            <ProtectedRoute requireLogista>
              <LogistaLayout />
            </ProtectedRoute>
          }
        >
          {logistaRoutes.map((route, i) => (
            <Route key={i} {...route} />
          ))}
        </Route>
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </div>
  )
}
