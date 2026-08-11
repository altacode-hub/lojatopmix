import { useState } from 'react'
import type { FirebaseError } from 'firebase/app'
import { useAuth } from '../context/AuthContext'
import type { ConfirmationResult } from 'firebase/auth'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import PainelLoading from './PainelLoading'
import { logistaTheme } from './logista/logistaTheme'
import { get, ref } from 'firebase/database'
import { rtdb } from '../service/firebase'

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
  border: `1px solid ${logistaTheme.colors.errorBorder}`,
  background: logistaTheme.colors.errorBackground,
  color: logistaTheme.colors.errorText,
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

const checkIsLogista = async (uid: string): Promise<boolean> => {
  const logistaRef = ref(rtdb, `loja/arealogista/${uid}`)
  const snapshot = await get(logistaRef)
  return snapshot.val() === true
}

const setupClienteProfileIfNotExists = async (uid: string, phoneNumber: string | null) => {
  const profileRef = ref(rtdb, `clientes/${uid}/perfil`)
  const snapshot = await get(profileRef)

  if (!snapshot.exists()) {
    const { set } = await import('firebase/database')
    const phone = phoneNumber ? phoneNumber.replace('+55', '') : ''
    await set(profileRef, {
      fullName: '',
      email: '',
      cpf: '',
      phone,
    })
  }
}

const CLIENTE_APP_URL = 'https://lojatopmix.web.app'

export default function LoginPainel() {
  const { sendCode, isLogista, loading: authLoading } = useAuth()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (authLoading || isLogista === undefined) {
    return <PainelLoading />
  }

  if (isLogista) {
    return <Navigate to="/" replace />
  }

  const requestCode = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!phone || !digits) {
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
      const conf = await sendCode('+55' + digits, 'recaptcha-container')
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
      const result = await confirmation.confirm(code)
      const uid = result.user.uid
      const phoneNumber = result.user.phoneNumber

      const logista = await checkIsLogista(uid)

      if (logista) {
        navigate('/', { replace: true })
      } else {
        await setupClienteProfileIfNotExists(uid, phoneNumber)
        window.location.href = CLIENTE_APP_URL
      }
    } catch (error) {
      setError(getErrorMessage(error, 'Nao foi possivel confirmar o codigo informado. Revise o SMS e tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: 360,
      margin: '40px auto',
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      background: logistaTheme.colors.surface,
      borderRadius: logistaTheme.radius.lg,
      border: `1px solid ${logistaTheme.colors.border}`,
      boxShadow: logistaTheme.shadow.card,
    }}>
      <h2 style={{ color: logistaTheme.colors.accentDark, textAlign: 'center' }}>Acesso ao Painel</h2>
      <p style={{ color: logistaTheme.colors.textMuted, textAlign: 'center', fontSize: 14, marginTop: 4 }}>
        Área exclusiva para colaboradores da loja
      </p>

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
              border: `1px solid ${logistaTheme.colors.borderStrong}`,
              outline: 'none',
              background: logistaTheme.colors.surfaceAlt,
              color: logistaTheme.colors.text,
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
              background: phone.length === 11 ? logistaTheme.colors.accent : logistaTheme.colors.accentSoft,
              color: logistaTheme.colors.surface,
              fontWeight: 700,
              cursor: phone.length === 11 ? 'pointer' : 'not-allowed',
            }}>
            Enviar código
          </button>
          <div id="recaptcha-container" style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: 12 }} />
          {error && <div style={errorBoxStyle}>{error}</div>}
          <div style={{ margin: '16px 0', height: 1, background: logistaTheme.colors.border }} />
        </>
      ) : (
        <>
          <input
            placeholder="Código SMS"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              marginTop: 12,
              borderRadius: 12,
              border: `1px solid ${logistaTheme.colors.borderStrong}`,
              outline: 'none',
              background: logistaTheme.colors.surfaceAlt,
              color: logistaTheme.colors.text,
            }}
          />
          <button onClick={confirmCode} disabled={loading || !code} style={{
            width: '100%',
            padding: '14px 16px',
            marginTop: 12,
            borderRadius: 12,
            border: '1px solid transparent',
            background: code ? logistaTheme.colors.accent : logistaTheme.colors.accentSoft,
            color: logistaTheme.colors.surface,
            fontWeight: 700,
            cursor: code ? 'pointer' : 'not-allowed',
          }}>
            Confirmar
          </button>
          {error && <div style={errorBoxStyle}>{error}</div>}
          <div style={{ margin: '16px 0', height: 1, background: logistaTheme.colors.border }} />
        </>
      )}

      <Link
        to="/termodeuso"
        style={{
          marginTop: 12,
          display: 'inline-block',
          textAlign: 'center',
          color: logistaTheme.colors.textMuted,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        Termos de Uso e Política de Privacidade
      </Link>
    </div>
  )
}
