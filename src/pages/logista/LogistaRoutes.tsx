import Logista from './Logista'
import NovoPedido from './NovoPedido'
import AdicionarProdutos from './AdicionarProdutos'
import PedidoDetalhes from './PedidoDetalhes'
import PublicarVitrine from './PublicarVitrine'

export const logistaRoutes = [
  { index: true, element: <Logista /> },
  { path: 'novo-pedido', element: <NovoPedido /> },
  { path: 'novo-pedido/:purchaseId/produtos', element: <AdicionarProdutos /> },
  { path: 'pedido/:purchaseId/vitrine', element: <PublicarVitrine /> },
  { path: 'pedido/:purchaseId', element: <PedidoDetalhes /> },
]
