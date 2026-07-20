import { useState } from 'react'
import type { FirebaseError } from 'firebase/app'
import { useAuth } from '../context/AuthContext'
import type { ConfirmationResult } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-phone-number': 'O telefone informado e invalido. Digite o numero com DDD.',
  'auth/operation-not-allowed': 'Este tipo de acesso nao esta habilitado no momento. Tente novamente mais tarde.',
  'auth/too-many-requests': 'Muitas tentativas foram feitas. Aguarde alguns minutos antes de tentar novamente.',
  'auth/user-disabled': 'Esta conta foi desativada. Entre em contato com o suporte.',
  'auth/internal-error': 'Ocorreu um erro interno na autenticacao. Tente novamente em instantes.',
}

const errorBoxStyle = {
  marginTop: 8,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #f3b3b3',
  background: '#fff5f5',
  color: '#b42318',
  fontSize: 14,
} as const

const isFirebaseError = (error: unknown): error is FirebaseError =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isFirebaseError(error)) {
    return AUTH_ERROR_MESSAGES[error.code] ?? fallback
  }

  return fallback
}

export default function Login() {
  const { sendCode, signInAnonymously } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const requestCode = async () => {
    const digits = phone.replace(/\D/g, '')

    if (!phone) {
      setError('Informe o telefone com DDD, ex: 93...');
      return
    }
    if (!digits) {
      setError('Informe o telefone com DDD, ex: 93...');
      return
    }
    if (digits.length !== 11) {
      setError('Informe um telefone valido com 11 digitos, incluindo o DDD.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const phoneE164 = digits
      //const phoneE164 = phone.startsWith('+') ? phone : digits ? `+${digits}` : ''
      const conf = await sendCode('+55' + phoneE164, 'recaptcha-container')
      setConfirmation(conf)
    } catch (error) {
      setError(getErrorMessage(error, 'Nao foi possivel enviar o codigo. Verifique o telefone e tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  const confirmCode = async () => {
    if (!confirmation) return
    setError(null)
    setLoading(true)
    try {
      await confirmation.confirm(code)
      navigate('/checkout', { replace: true })
    } catch (error) {
      setError(getErrorMessage(error, 'Nao foi possivel confirmar o codigo informado. Revise o SMS e tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  const handleAnon = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInAnonymously()
      navigate('/checkout', { replace: true })
    } catch (error) {
      setError(getErrorMessage(error, 'Nao foi possivel entrar como convidado no momento. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={
      { maxWidth: 360, 
        margin: '40px auto', 
        display: 'flex', 
        flexDirection: 'column' 
      }}
    >
      <h2>Entrar com telefone</h2>
      {!confirmation ? (
        <>
          <input
            placeholder="93911220000"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '14px 16px', 
              marginTop: 12,
              borderRadius: 12,
              border: '1px solid #b58516',
              outline: 'none',
            }}
          />
          <button 
            onClick={requestCode} 
            disabled={loading || phone.length !== 11} 
            style={{ 
              width: '100%', 
              padding: '14px 16px',
              marginTop: 12,
              borderRadius: 12,
              border: '1px solid transparent',
              background: phone.length === 11 ? '#b58516' : '#b9b5b1',
              color: '#fff',
              fontWeight: 700,
              cursor: phone.length === 11 ? 'pointer' : 'not-allowed', 
            }}>
            Enviar código
          </button>
          <div id="recaptcha-container" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 12,
          }} />
          {error && <div style={errorBoxStyle}>{error}</div>}
          <div style={{ margin: '16px 0', height: 1, background: '#ddd' }} />
          
        </>
      ) : (
        <>
          <input
            placeholder="Código SMS"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: '100%', padding: 10, marginTop: 12 }}
          />
          <button onClick={confirmCode} disabled={loading || !code} style={{ width: '100%', padding: 10, marginTop: 12 }}>
            Confirmar
          </button>
          {error && <div style={errorBoxStyle}>{error}</div>}
          <div style={{ margin: '16px 0', height: 1, background: '#ddd' }} />

        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'row', gap: 12 }}>
        <Link
          to="/"
          style={{
            width: '100%',
            marginTop: 12,
            display: 'inline-block',
            textAlign: 'center',
            color: '#b58516',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 12,
            background: 'transparent',
          }}
        >
          Voltar para a loja
        </Link>

        <button 
          onClick={handleAnon} 
          disabled={loading} 
          style={{ 
            width: '100%',
            textAlign: 'center',
            marginTop: 12,
            padding: 0,
            color: '#b58516',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 12,
            background: 'transparent', 
            }}>
          Entrar como convidado
        </button>
      </div>
    </div>
  )
}
