import Logista from './Logista'
import NovoPedido from './NovoPedido'

export const logistaRoutes = [
  { index: true, element: <Logista /> },
  { path: 'novo-pedido', element: <NovoPedido /> },
]

