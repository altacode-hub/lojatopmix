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
import { logistaTheme } from './logista/logistaTheme'
import '../App.css'

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
    //window.location.href = 'https://lojatopmix.web.app'
    return null
  }
  if (!isLogista) {
    console.log('[AppPainel FallbackRoute] ❌ Usuário logado mas isLogista=false → exibindo tela de erro', {
      uid: user.uid, isCliente, isLogista
    })
    return (
      <div style={{
        maxWidth: 520,
        margin: '80px auto',
        padding: 24,
        background: logistaTheme.colors.errorBackground,
        border: `1px solid ${logistaTheme.colors.errorBorder}`,
        borderRadius: logistaTheme.radius.lg,
        color: logistaTheme.colors.errorText,
      }}>
        <h2 style={{ marginTop: 0, fontSize: 20 }}>🚫 Acesso não autorizado</h2>
        <p style={{ marginTop: 0 }}>
          A autenticação funcionou, mas o RTDB não reconhece este usuário como logista.
        </p>
        <ul style={{ marginTop: 12, paddingLeft: 20 }}>
          <li>UID do usuário autenticado: <strong style={{ fontFamily: 'monospace' }}>{user.uid}</strong></li>
          <li>Caminho esperado no RTDB: <strong style={{ fontFamily: 'monospace' }}>loja/arealogista/{user.uid}</strong></li>
          <li>Valor esperado: <strong>true</strong> (boolean estrito)</li>
        </ul>
        <div style={{ marginTop: 16, padding: 12, background: logistaTheme.colors.surface, borderRadius: 10, border: `1px solid ${logistaTheme.colors.border}`, color: logistaTheme.colors.text }}>
          <strong>Passos para diagnosticar:</strong>
          <ol style={{ marginTop: 6, paddingLeft: 20 }}>
            <li>Abra o Console do navegador (F12) e veja os logs com prefixo <code>[AuthContext]</code></li>
            <li>Confira no Firebase Realtime Database se o caminho acima existe com valor <strong>true</strong></li>
            <li>Acesse a página de <a href="/debug" style={{ color: logistaTheme.colors.accentDark }}>/debug</a> para ver o estado completo</li>
          </ol>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => (window.location.href = '/debug')}
            style={{
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              background: logistaTheme.colors.accent, color: logistaTheme.colors.surface,
              border: '1px solid transparent', fontWeight: 700,
            }}
          >
            Ir para Debug
          </button>
          <button
            onClick={() => (window.location.href = '/login')}
            style={{
              padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
              background: logistaTheme.colors.surfaceAlt, color: logistaTheme.colors.text,
              border: `1px solid ${logistaTheme.colors.borderStrong}`,
            }}
          >
            Refazer Login
          </button>
        </div>
      </div>
    )
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
