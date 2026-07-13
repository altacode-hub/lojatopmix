import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import type { ConfirmationResult } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message
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
    setError(null)
    setLoading(true)
    try {
      const digits = phone.replace(/\D/g, '')
      const phoneE164 = phone.startsWith('+') ? phone : digits ? `+${digits}` : ''
      const conf = await sendCode(phoneE164, 'recaptcha-container')
      setConfirmation(conf)
    } catch (error) {
      setError(getErrorMessage(error, 'Erro ao enviar código'))
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
      setError(getErrorMessage(error, 'Código inválido'))
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
      setError(getErrorMessage(error, 'Erro ao entrar como convidado'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '40px auto' }}>
      <h2>Entrar com telefone</h2>
      {!confirmation ? (
        <>
          <input
            placeholder="+55XXXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: 10, marginTop: 12 }}
          />
          <button onClick={requestCode} disabled={loading || !phone.replace(/\D/g, '')} style={{ width: '100%', padding: 10, marginTop: 12 }}>
            Enviar código
          </button>
          <div id="recaptcha-container" />
          <div style={{ margin: '16px 0', height: 1, background: '#ddd' }} />
          <button onClick={handleAnon} disabled={loading} style={{ width: '100%', padding: 10 }}>
            Entrar como convidado
          </button>
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
          <div style={{ margin: '16px 0', height: 1, background: '#ddd' }} />
          <button onClick={handleAnon} disabled={loading} style={{ width: '100%', padding: 10 }}>
            Entrar como convidado
          </button>
        </>
      )}
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
    </div>
  )
}
