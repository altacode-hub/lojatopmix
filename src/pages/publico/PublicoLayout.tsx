import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { rtdb } from '../../service/firebase'
import { ref, onValue, off, type DataSnapshot } from 'firebase/database'
// icons
import { FiSearch, FiUser } from "react-icons/fi";
import logo from '../../assets/logo.png'
import { TiShoppingCart } from 'react-icons/ti';
import { IoInformationOutline } from 'react-icons/io5';

export default function PublicoLayout() {
  const [online, setOnline] = useState(true)
  const [isLogista, setIsLogista] = useState(false)
  const location = useLocation()
  const { items } = useCart()
  const cartCount = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items])
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

  const isActive = (path: string) => location.pathname === path

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6f8', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: '0 auto',
            padding: '10px 16px',
            display: 'grid',
            gridTemplateColumns: '100px auto 60px auto',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: '#0f172a' }}>
            <img
              src={logo}
              alt="Top Mix Store"
              style={{ height: 100, width: 100, objectFit: 'contain', borderRadius: 25, background: '#f1f5f9' }}
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
              }}
            />
          </Link>
          <div style={{ display: 'grid', justifyContent: "end" }}>
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: 999,
                padding: '8px 12px',
              }}
            >
              <input
                type="search"
                placeholder="Faça sua busca"
                aria-label="Buscar produtos"
                style={{
                  outline: 'none',
                  border: 'none',
                  background: 'transparent',
                  fontSize: 14,
                  color: '#0f172a',
                }}
              />
              <div style={{ 
                color: '#64748b', 
                flex: 1,
                display: 'flex',
                alignItems: 'center', }}
              >
                  <FiSearch size={15}  />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center',}}>
            <Link
              to="/politicaPrivacidade"
              title="Informações"
              style={{
                textDecoration: 'none',
                color: '#0f172a',
                background: isActive('/politicaPrivacidade') ? '#f1f5f9' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
              }}
            >
              <div style={{flex:1, display: 'flex', justifyContent: 'center'}}><IoInformationOutline size={20} /></div>
            </Link>
            <Link
              to="/cart"
              title="Carrinho"
              style={{
                position: 'relative',
                textDecoration: 'none',
                color: '#0f172a',
                background: isActive('/cart') ? '#f1f5f9' : '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
              }}
            >
              <div style={{flex:1, display: 'flex', justifyContent: 'center'}}><TiShoppingCart size={20} color='#333'/></div>
              {cartCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                    border: '2px solid #fff',
                  }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
          <Link
            to={user ? (isLogista ? "/logista" : "/cliente") : "/login"}
            style={{
              textDecoration: 'none',
              color: '#0f172a',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              border: '1px solid #e2e8f0',
            }}
          >
            <FiUser size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {user ? (isLogista ? `Área Logista` : `Olá!`) : 'olá, faça seu'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                {user ? (user.phoneNumber || 'Usuário') : 'login ou cadastre-se'}
              </div>
            </div>
          </Link>
        </div>
      </header>

      <section style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '12px 16px' }}>
          <div style={{ fontWeight:  700, fontSize: 'var(--font-size-grande)', color: '#797979', wordBreak: 'break-word', marginBottom: 10, textAlign: 'left'  }}>Categorias</div>
          <div
            style={{
              display: 'flex',
              gap: 18,
              overflowX: 'auto',
              paddingBottom: 8,
              scrollbarWidth: 'thin',
            }}
          >
            {[
              { label: 'Novidades', emoji: '' },
              { label: 'Feminino', emoji: '' },
              { label: 'Masculino', emoji: '' },
              { label: 'Infantil', emoji: '' },
              { label: 'Calçados', emoji: '' },
              { label: 'Acessórios', emoji: '' },
              { label: 'Promoções', emoji: '' },
              { label: 'Inverno', emoji: '' },
              { label: 'Verão', emoji: '' },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.label}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 28,
                  }}
                >
                  {c.emoji}
                </span>
                <span style={{ fontSize: 12, color: '#334155' }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

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
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px' }}>
          <Outlet />
        </div>
      </main>

      <footer style={{ background: '#0f172a', color: '#cbd5e1', marginTop: 'auto' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '16px' }}>
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
