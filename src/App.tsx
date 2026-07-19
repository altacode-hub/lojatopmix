import { Navigate, Route, Routes } from 'react-router-dom'
import HomeLayout from './pages/publico/HomeLayout'
import { publicoRoutes } from './pages/publico/PublicoRoutes'
import Checkout from './pages/Checkout'
import CheckoutReturn from './pages/CheckoutReturn'
import Cliente from './pages/Cliente'
import LogistaLayout from './pages/logista/LogistaLayout'
import { logistaRoutes } from './pages/logista/LogistaRoutes'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import './App.css'

function FallbackRoute() {
  const { user, loading, isLogista, profileLoading } = useAuth()

  if (loading || profileLoading) return <div>Carregando...</div>
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
        <Route path="/checkout/retorno" element={<CheckoutReturn />} />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cliente"
          element={
            <ProtectedRoute>
              <Cliente />
            </ProtectedRoute>
          }
        />
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
