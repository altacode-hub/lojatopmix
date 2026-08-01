import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import AppCliente from './AppCliente'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { CartProvider } from '../context/CartContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppCliente />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
