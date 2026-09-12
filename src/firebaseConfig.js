export function readFirebaseConfig(env) {
  const values = {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() || '',
  }
  const destination = env.VITE_LEDGER_SYNC_URL?.trim() || ''
  const uid = env.VITE_FIREBASE_ALLOWED_UIDS?.trim() || ''
  const enabled = Boolean(destination || uid || Object.values(values).some(Boolean))
  let syncUrl = ''
  try {
    const url = new URL(destination)
    if (url.protocol === 'https:' &&
        /\.(firebasedatabase\.app|firebaseio\.com)$/.test(url.hostname) &&
        /^\/expenseTracker\/main(?:\.json)?$/.test(url.pathname) &&
        !url.search && !url.hash && !url.username && !url.password && !url.port) {
      url.pathname = '/expenseTracker/main.json'
      syncUrl = url.toString()
    }
  } catch { /* An incomplete configuration stays behind the setup screen. */ }
  return {
    enabled,
    valid: Boolean(syncUrl && uid && !uid.includes(',') && Object.values(values).every(Boolean)),
    firebase: values,
    uid,
    syncUrl,
  }
}
