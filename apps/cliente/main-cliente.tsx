import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import AppCliente from '../../src/app-cliente/AppCliente'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/context/AuthContext'
import { CartProvider } from '../../src/context/CartContext'

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
