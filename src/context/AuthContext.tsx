import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { auth, rtdb, setupRecaptcha } from '../service/firebase'
import type { ConfirmationResult } from 'firebase/auth'
import { onAuthStateChanged, signInWithPhoneNumber, signInAnonymously as fbSignInAnonymously, signOut as fbSignOut } from 'firebase/auth'
import { off, onValue, ref, type DataSnapshot } from 'firebase/database'

type AuthContextType = {
  user: { uid: string; phoneNumber: string | null } | null
  loading: boolean
  isLogista: boolean
  profileLoading: boolean
  sendCode: (phone: string, recaptchaContainerId: string) => Promise<ConfirmationResult>
  signInAnonymously: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLogista: false,
  profileLoading: true,
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
  const [isLogista, setIsLogista] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const recaptchaRef = useRef<ReturnType<typeof setupRecaptcha> | null>(null)

  useEffect(() => {
    auth.languageCode = 'pt'

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? { uid: u.uid, phoneNumber: u.phoneNumber } : null)
      if (!u) {
        setIsLogista(false)
        setProfileLoading(false)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) {
      setIsLogista(false)
      setProfileLoading(false)
      return
    }

    setProfileLoading(true)
    const logistaRef = ref(rtdb, `loja/arealogista/${user.uid}`)
    const handleValue = (snapshot: DataSnapshot) => {
      setIsLogista(Boolean(snapshot.val()))
      setProfileLoading(false)
    }

    onValue(logistaRef, handleValue)

    return () => {
      off(logistaRef, 'value', handleValue)
    }
  }, [user])

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

  const value = useMemo(
    () => ({ user, loading, isLogista, profileLoading, sendCode, signInAnonymously, signOut }),
    [user, loading, isLogista, profileLoading],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext)
