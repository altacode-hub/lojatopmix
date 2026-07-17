import { Outlet, useLocation, Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, off, type DataSnapshot } from 'firebase/database'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import PublicHeader from './components/PublicHeader'

export default function HomeLayout() {
  const [online, setOnline] = useState(true)
  const [isLogista, setIsLogista] = useState(false)
  const location = useLocation()
  const { items } = useCart()
  const cartCount = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items])
  const { user } = useAuth()

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setIsLogista(false)
      return
    }

    const logistaRef = ref(rtdb, `loja/arealogista/${user.uid}`)
    const handleValue = (snapshot: DataSnapshot) => {
      setIsLogista(Boolean(snapshot.val()))
    }

    onValue(logistaRef, handleValue)

    return () => {
      off(logistaRef, 'value', handleValue)
    }
  }, [user])

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader
        cartCount={cartCount}
        infoActive={location.pathname === '/politicaPrivacidade'}
        cartActive={location.pathname === '/cart'}
        accountHref={user ? (isLogista ? '/logista' : '/cliente') : '/login'}
        accountPrimaryLabel={user ? (isLogista ? 'Área Logista' : 'Olá!') : 'olá, faça seu'}
        accountSecondaryLabel={user ? user.phoneNumber || 'Usuário' : 'login ou cadastre-se'}
      />

      {!online && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.92)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 20,
          }}
        >
          <div style={{ fontSize: 16, background: 'rgba(255,255,255,0.06)', padding: '14px 18px', borderRadius: 12 }}>
            Verificando conexão, aguarde...
          </div>
        </div>
      )}

      <main style={{ flex: 1 }}>
        <div style={{ width: '-webkit-fill-available', margin: '0 auto', padding: '12px 26px' }}>
          <Outlet />
        </div>
      </main>

      <footer style={{ background: '#0f172a', color: '#cbd5e1', marginTop: 'auto' }}>
        <div style={{ width: '-webkit-fill-available', margin: '0 auto', padding: '16px' }}>
          <div>© {new Date().getFullYear()} Top Mix Store</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            <Link to="/politicaPrivacidade" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
              Política de Privacidade
            </Link>
            <span style={{ opacity: 0.5 }}>•</span>
            <Link to="/termodeuso" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
