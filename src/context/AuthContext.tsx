import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { auth, setupRecaptcha } from '../service/firebase'
import type { ConfirmationResult } from 'firebase/auth'
import { onAuthStateChanged, signInWithPhoneNumber, signInAnonymously as fbSignInAnonymously, signOut as fbSignOut } from 'firebase/auth'

type AuthContextType = {
  user: { uid: string; phoneNumber: string | null } | null
  loading: boolean
  sendCode: (phone: string, recaptchaContainerId: string) => Promise<ConfirmationResult>
  signInAnonymously: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
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
  const recaptchaRef = useRef<ReturnType<typeof setupRecaptcha> | null>(null)

  useEffect(() => {
    auth.languageCode = 'pt'

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, phoneNumber: u.phoneNumber } : null)
      setLoading(false)
    })
    return () => unsub()
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

  const value = useMemo(() => ({ user, loading, sendCode, signInAnonymously, signOut }), [user, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
