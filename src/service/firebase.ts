import { initializeApp } from 'firebase/app'
import { getAuth, RecaptchaVerifier } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics } from 'firebase/analytics'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyDtchFVqj5__h5bYpciU2uAdcgDAWwei0E',
  authDomain: 'lojatopmix.firebaseapp.com',
  databaseURL: 'https://lojatopmix-default-rtdb.firebaseio.com',
  projectId: 'lojatopmix',
  storageBucket: 'lojatopmix.firebasestorage.app',
  messagingSenderId: '82516280905',
  appId: '1:82516280905:web:9bbd061f67f9b75d052198',
  measurementId: 'G-8SQDRW39S9',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const analytics = getAnalytics(app)
export const rtdb = getDatabase(app)
export const setupRecaptcha = (elementId: string, size: 'invisible' | 'normal' | 'compact' = 'invisible') =>
  new RecaptchaVerifier(auth, elementId, { size })
