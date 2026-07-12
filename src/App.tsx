import { Route, Routes } from 'react-router-dom'
import PublicoLayout from './pages/publico/PublicoLayout'
import { publicoRoutes } from './pages/publico/PublicoRoutes'
import Checkout from './pages/Checkout'
import CheckoutReturn from './pages/CheckoutReturn'
import Cliente from './pages/Cliente'
import LogistaLayout from './pages/logista/LogistaLayout'
import { logistaRoutes } from './pages/logista/LogistaRoutes'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<PublicoLayout />}>
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
            <ProtectedRoute>
              <LogistaLayout />
            </ProtectedRoute>
          }
        >
          {logistaRoutes.map((route, i) => (
            <Route key={i} {...route} />
          ))}
        </Route>
      </Routes>
    </div>
  )
}
