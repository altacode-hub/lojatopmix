import { Navigate, Route, Routes } from 'react-router-dom'
import HomeLayout from './publico/HomeLayout'
import { publicoRoutes } from './publico/PublicoRoutes'
import ClienteLayout from './cliente/ClienteLayout'
import { clienteRoutes } from './cliente/ClienteRoutes'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../context/AuthContext'
import '../App.css'
import PainelLoading from '../app-painel/PainelLoading'

function FallbackRoute() {
  const { user, loading, profileLoading } = useAuth()

  if (loading || profileLoading) return (<div>
    <PainelLoading />
  </div>)
  if (!user) return <Navigate to="/" replace />
  return <Navigate to="/cliente" replace />
}

export default function AppCliente() {
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
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </div>
  )
}
