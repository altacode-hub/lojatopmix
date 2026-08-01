import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { auth, rtdb, setupRecaptcha } from '../service/firebase'
import type { ConfirmationResult } from 'firebase/auth'
import { onAuthStateChanged, signInWithPhoneNumber, signInAnonymously as fbSignInAnonymously, signOut as fbSignOut } from 'firebase/auth'
import { off, onValue, ref, set, type DataSnapshot } from 'firebase/database'
import type { ClienteProfileDraft } from '../app-cliente/cliente/clientStorage'

const normalizeClienteProfile = (
  profile: Partial<ClienteProfileDraft> | null | undefined,
  phoneNumber: string | null,
): ClienteProfileDraft => ({
  fullName: typeof profile?.fullName === 'string' ? profile.fullName : '',
  email: typeof profile?.email === 'string' ? profile.email : '',
  cpf: typeof profile?.cpf === 'string' ? profile.cpf : '',
  phone: typeof profile?.phone === 'string' && profile.phone.trim() ? profile.phone : phoneNumber || '',
})

type AuthContextType = {
  user: { uid: string; phoneNumber: string | null } | null
  loading: boolean
  isLogista: boolean | undefined
  isCliente: boolean
  profileLoading: boolean
  clientProfile: ClienteProfileDraft | null
  saveClienteProfile: (profile: ClienteProfileDraft) => Promise<void>
  sendCode: (phone: string, recaptchaContainerId: string) => Promise<ConfirmationResult>
  signInAnonymously: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLogista: undefined,
  isCliente: false,
  profileLoading: true,
  clientProfile: null,
  saveClienteProfile: async () => {
    throw new Error('not implemented')
  },
  sendCode: async () => {
    throw new Error('not implemented')
  },
  signInAnonymously: async () => {
    throw new Error('not implemented')
  },
  signOut: async () => {
    throw new Error('not implemented')
  },
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null)
  const [loading, setLoading] = useState(true)
  const [isLogista, setIsLogista] = useState<boolean | undefined>(undefined)
  const [profileLoading, setProfileLoading] = useState(true)
  const [clientProfile, setClientProfile] = useState<ClienteProfileDraft | null>(null)
  const recaptchaRef = useRef<ReturnType<typeof setupRecaptcha> | null>(null)

  useEffect(() => {
    auth.languageCode = 'pt'

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, phoneNumber: u.phoneNumber } : null)
      if (!u) {
        setIsLogista(false)
        setClientProfile(null)
      }
      setTimeout(() => setLoading(false), 1500)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return

    const logistaRef = ref(rtdb, `loja/arealogista/${user.uid}`)
    const clienteProfileRef = ref(rtdb, `clientes/${user.uid}/perfil`)
    let roleResolved = false
    let clienteProfileResolved = false

    console.log('[AuthContext] 🔍 Consultando perfil do RTDB', {
      uid: user.uid,
      phone: user.phoneNumber,
      logistaPath: `loja/arealogista/${user.uid}`,
      clienteProfilePath: `clientes/${user.uid}/perfil`,
    })

    const completeProfileLoading = () => {
      if (roleResolved && clienteProfileResolved) {
        setProfileLoading(false)
        console.log('[AuthContext] ✅ Perfil carregado completamente', {
          isLogistaFinal: roleResolved,
          hasClientProfile: clienteProfileResolved,
        })
      }
    }

    const handleLogistaValue = (snapshot: DataSnapshot) => {
      const val = snapshot.val()
      const logista = val === true
      console.log('[AuthContext] 🔑 Resposta RTDB (loja/arealogista/' + user.uid + ')', {
        valorBruto: val,
        tipoDoValor: typeof val,
        snapshotExists: snapshot.exists(),
        isLogistaResultado: logista,
      })
      setIsLogista(logista)
      roleResolved = true
      completeProfileLoading()
    }

    const handleLogistaError = (err: unknown) => {
      console.error('[AuthContext] ❌ ERRO ao ler loja/arealogista/' + user.uid, {
        mensagem: err instanceof Error ? err.message : String(err),
        detalhes: err,
      })
      setIsLogista(false)
      roleResolved = true
      completeProfileLoading()
    }

    const handleClienteProfileValue = (snapshot: DataSnapshot) => {
      const profile = snapshot.exists()
        ? normalizeClienteProfile(snapshot.val() as Partial<ClienteProfileDraft>, user.phoneNumber)
        : normalizeClienteProfile(null, user.phoneNumber)
      console.log('[AuthContext] 👤 Perfil do cliente carregado', {
        snapshotExists: snapshot.exists(),
        profile,
      })
      setClientProfile(profile)
      clienteProfileResolved = true
      completeProfileLoading()
    }

    const handleProfileReadError = (err: unknown) => {
      console.error('[AuthContext] ❌ ERRO ao ler clientes/' + user.uid + '/perfil', err)
      setClientProfile(normalizeClienteProfile(null, user.phoneNumber))
      clienteProfileResolved = true
      completeProfileLoading()
    }

    onValue(logistaRef, handleLogistaValue, handleLogistaError)
    onValue(clienteProfileRef, handleClienteProfileValue, handleProfileReadError)

    return () => {
      off(logistaRef, 'value', handleLogistaValue)
      off(clienteProfileRef, 'value', handleClienteProfileValue)
    }
  }, [user])

  const saveClienteProfile = useCallback(async (profile: ClienteProfileDraft) => {
    const currentUser = auth.currentUser

    if (!currentUser) {
      throw new Error('Usuario nao autenticado.')
    }

    const normalizedProfile = normalizeClienteProfile(profile, currentUser.phoneNumber)
    await set(ref(rtdb, `clientes/${currentUser.uid}/perfil`), normalizedProfile)
    setClientProfile(normalizedProfile)
  }, [])

  const sendCode = async (phone: string, recaptchaContainerId: string) => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear()
      } catch {
        // O verifier anterior pode já ter sido descartado pelo Firebase.
      }
    }
    const verifier = (recaptchaRef.current = setupRecaptcha(recaptchaContainerId, 'normal'))
    await verifier.render()
    return signInWithPhoneNumber(auth, phone, verifier)
  }

  const signInAnonymously = async () => {
    await fbSignInAnonymously(auth)
  }

  const signOut = async () => {
    await fbSignOut(auth)
  }

  const isCliente = Boolean(user) && !isLogista

  const value = useMemo(
    () => ({
      user,
      loading,
      isLogista,
      isCliente,
      profileLoading,
      clientProfile,
      saveClienteProfile,
      sendCode,
      signInAnonymously,
      signOut,
    }),
    [user, loading, isLogista, isCliente, profileLoading, clientProfile, saveClienteProfile],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
