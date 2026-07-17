import { Link } from 'react-router-dom'
import { FiUser } from 'react-icons/fi'
import { TiShoppingCart } from 'react-icons/ti'
import { IoInformationOutline } from 'react-icons/io5'
import logo from '../../../assets/logo.png'
import { useMediaQuery } from '../../../hooks/useMediaQuery'

interface PublicHeaderProps {
  cartCount: number
  infoActive: boolean
  cartActive: boolean
  accountHref: string
  accountPrimaryLabel: string
  accountSecondaryLabel: string
}

export default function PublicHeader({
  cartCount,
  infoActive,
  cartActive,
  accountHref,
  accountPrimaryLabel,
  accountSecondaryLabel,
}: PublicHeaderProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
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
          margin: '0 auto',
          maxWidth: 1440,
          padding: isMobile ? '10px 14px 12px' : '10px 26px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '128px auto 55px' : '170px auto 180px',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: '#0f172a',
            //gridColumn: isMobile ? '1 / 2' : 'auto',
          }}
        >
          <img
            src={logo}
            alt="Top Mix Store"
            style={{
              width: isMobile ? 78 : 110,
              objectFit: 'contain',
              borderRadius: 8,
              background: '#f1f5f9',
            }}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Link
            to="/politicaPrivacidade"
            title="Informações"
            style={{
              textDecoration: 'none',
              color: '#0f172a',
              background: infoActive ? '#f1f5f9' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
            }}
          >
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <IoInformationOutline size={20} />
            </div>
          </Link>
          <Link
            to="/cart"
            title="Carrinho"
            style={{
              position: 'relative',
              textDecoration: 'none',
              color: '#0f172a',
              background: cartActive ? '#f1f5f9' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
            }}
          >
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <TiShoppingCart size={20} color="#333" />
            </div>
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
          to={accountHref}
          style={{
            textDecoration: 'none',
            color: '#0f172a',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 0 : 8,
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid #e2e8f0',
            justifyContent: isMobile ? 'center' : 'flex-start',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          <FiUser size={20} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{!isMobile ? accountPrimaryLabel : ""}</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{!isMobile ? accountSecondaryLabel : ""}</div>
          </div>
        </Link>
      </div>
    </header>
  )
}
