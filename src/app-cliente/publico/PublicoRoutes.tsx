import Home from './Home'
import LoginCliente from '../LoginCliente'
import PoliticaPrivacidade from './PoliticaPrivacidade'
import TermoDeUso from './TermoDeUso'
import ProductDetail from './ProductDetail'

export const publicoRoutes = [
  { index: true, element: <Home /> },
  { path: 'produto/:id', element: <ProductDetail /> },
  { path: 'login', element: <LoginCliente /> },
  { path: 'politicaPrivacidade', element: <PoliticaPrivacidade /> },
  { path: 'termodeuso', element: <TermoDeUso /> },
]
