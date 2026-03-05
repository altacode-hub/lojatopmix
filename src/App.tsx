import { Link, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Cliente from './pages/Cliente'
import Logista from './pages/Logista'
import Login from './pages/Login'
import PoliticaPrivacidade from './pages/PoliticaPrivacidade'
import TermoDeUso from './pages/TermoDeUso'
import ProtectedRoute from './components/ProtectedRoute'
import './App.css'

export default function App() {
  return (
    <div>
      <nav style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #eee' }}>
        <Link to="/">Vitrine</Link>
        <Link to="/cart">Carrinho</Link>
        <Link to="/cliente">Área do Cliente</Link>
        <Link to="/logista">Área do Logista</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cart" element={<Cart />} />
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
              <Logista />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/politicaPrivacidade" element={<PoliticaPrivacidade />} />
        <Route path="/termodeuso" element={<TermoDeUso />} />
      </Routes>
    </div>
  )
}
