import Logista from './Logista'
import NovoPedido from './NovoPedido'
import AdicionarProdutos from './AdicionarProdutos'
import PedidoDetalhes from './PedidoDetalhes'
import PublicarVitrine from './PublicarVitrine'
import VendasLogista from './VendasLogista'
import EstoqueLogista from './EstoqueLogista'
import ProdutoEstoque from './ProdutoEstoque'
import CounterSalePayment from './CounterSalePayment'

export const logistaRoutes = [
  { index: true, element: <Logista /> },
  { path: 'vendas', element: <VendasLogista /> },
  { path: 'vendas/pagamento', element: <CounterSalePayment /> },
  { path: 'estoque', element: <EstoqueLogista /> },
  { path: 'estoque/:productId', element: <ProdutoEstoque /> },
  { path: 'novo-pedido', element: <NovoPedido /> },
  { path: 'novo-pedido/:purchaseId/produtos', element: <AdicionarProdutos /> },
  { path: 'pedido/:purchaseId/vitrine', element: <PublicarVitrine /> },
  { path: 'pedido/:purchaseId', element: <PedidoDetalhes /> },
]
