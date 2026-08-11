import { Navigate, Route, Routes } from 'react-router-dom'
import HomeLayout from './app-cliente/publico/HomeLayout'
import { publicoRoutes } from './app-cliente/publico/PublicoRoutes'
import ClienteLayout from './app-cliente/cliente/ClienteLayout'
import { clienteRoutes } from './app-cliente/cliente/ClienteRoutes'
import LogistaLayout from './app-painel/logista/LogistaLayout'
import { logistaRoutes } from './app-painel/logista/LogistaRoutes'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import './App.css'
import PainelLoading from './app-painel/PainelLoading'

function FallbackRoute() {
  const { user, loading, isLogista } = useAuth()

  if (loading || isLogista === undefined) return <PainelLoading />
  if (!user) return <Navigate to="/" replace />
  return <Navigate to={isLogista ? '/logista' : '/cliente'} replace />
}

export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<HomeLayout />}>
          {publicoRoutes.map((route, i) => (
            <Route key={i} {...route} />
          ))}
        </Route>
        <Route
          path="/cliente"
          element={
            <ProtectedRoute requireCliente>
              <ClienteLayout />
            </ProtectedRoute>
          }
        >
          {clienteRoutes.map((route, i) => (
            <Route key={i} {...route} />
          ))}
        </Route>
        <Route
          path="/logista"
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
