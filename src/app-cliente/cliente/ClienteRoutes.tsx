import { Navigate } from 'react-router-dom'
import ClienteCarrinho from './ClienteCarrinho'
import ClienteCheckout from './ClienteCheckout'
import ClienteCheckoutReturn from './ClienteCheckoutReturn'
import ClienteDadosCadastrais from './ClienteDadosCadastrais'
import ClienteEnderecos from './ClienteEnderecos'
import ClienteHome from './ClienteHome'
import ClientePedidos from './ClientePedidos'

export const clienteRoutes = [
  { index: true, element: <ClienteHome /> },
  { path: 'pedidos', element: <ClientePedidos /> },
  { path: 'dados-cadastrais', element: <ClienteDadosCadastrais /> },
  { path: 'enderecos', element: <ClienteEnderecos /> },
  { path: 'carrinho', element: <ClienteCarrinho /> },
  { path: 'checkout', element: <ClienteCheckout /> },
  { path: 'checkout/retorno', element: <ClienteCheckoutReturn /> },
  { path: '*', element: <Navigate to="/cliente" replace /> },
]
