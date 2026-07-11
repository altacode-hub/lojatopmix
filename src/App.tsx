import { Route, Routes } from 'react-router-dom'
import PublicoLayout from './pages/publico/PublicoLayout'
import Home from './pages/publico/Home'
import Cart from './pages/publico/Cart'
import Checkout from './pages/Checkout'
import Cliente from './pages/Cliente'
import Logista from './pages/logista/Logista'
import Login from './pages/Login'
import PoliticaPrivacidade from './pages/publico/PoliticaPrivacidade'
import TermoDeUso from './pages/publico/TermoDeUso'
import ProtectedRoute from './components/ProtectedRoute'
import NovoPedido from './pages/logista/NovoPedido'
import ProductDetail from './pages/publico/ProductDetail'
import './App.css'

export default function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<PublicoLayout />}>
          <Route index element={<Home />} />
          <Route path="produto/:id" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="login" element={<Login />} />
          <Route path="politicaPrivacidade" element={<PoliticaPrivacidade />} />
          <Route path="termodeuso" element={<TermoDeUso />} />
        </Route>
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
        <Route
          path="/logista/novo-pedido"
          element={
            <ProtectedRoute>
              <NovoPedido />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  )
}
