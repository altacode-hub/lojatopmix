import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import AppPainel from './AppPainel'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { CartProvider } from '../context/CartContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <AppPainel />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
