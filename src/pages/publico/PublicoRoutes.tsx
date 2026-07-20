import Home from './Home'
import Login from '../Login'
import PoliticaPrivacidade from './PoliticaPrivacidade'
import TermoDeUso from './TermoDeUso'
import ProductDetail from './ProductDetail'

export const publicoRoutes = [
  { index: true, element: <Home /> },
  { path: 'produto/:id', element: <ProductDetail /> },
  { path: 'login', element: <Login /> },
  { path: 'politicaPrivacidade', element: <PoliticaPrivacidade /> },
  { path: 'termodeuso', element: <TermoDeUso /> },
]
