import logoPng from '../assets/logo.png'
import { logistaTheme } from './logista/logistaTheme'

type PainelLoadingProps = {
  label?: string
  minHeight?: string
}

export default function PainelLoading({
  label = 'Carregando...',
  minHeight = '100vh',
}: PainelLoadingProps) {
  return (
    <div
      style={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: `linear-gradient(180deg, ${logistaTheme.colors.pageBackground} 0%, ${logistaTheme.colors.surfaceAlt} 100%)`,
        color: logistaTheme.colors.text,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: logistaTheme.colors.surface,
          border: `1px solid ${logistaTheme.colors.border}`,
          boxShadow: `0 20px 60px ${logistaTheme.colors.overlay}`,
          padding: 16,
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <img
          src={logoPng}
          alt="Top Mix"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            userSelect: 'none',
          }}
          draggable={false}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: logistaTheme.colors.text,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 20px 60px ${logistaTheme.colors.overlay};
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 24px 80px ${logistaTheme.colors.overlay};
          }
        }
      `}</style>
    </div>
  )
}
