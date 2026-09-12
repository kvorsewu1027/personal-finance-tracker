import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { readFirebaseConfig } from './firebaseConfig.js'

export const configuration = readFirebaseConfig(import.meta.env)
export const firebaseAuth = configuration.valid
  ? getAuth(initializeApp(configuration.firebase, 'personal-expense-tracker'))
  : null
