export function personalDatabase(syncUrl, user, fetchRequest = fetch) {
  async function request(options) {
    const url = new URL(syncUrl)
    url.searchParams.set('auth', await user.getIdToken())
    const response = await fetchRequest(url.toString(), {
      ...options,
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Personal database request failed: ${response.status}`)
    return response
  }
  return {
    async load() {
      const payload = await (await request()).json()
      if (payload === null) return null
      const state = payload.state || payload
      if (!state || typeof state !== 'object' || typeof state.selectedMonth !== 'string') {
        throw new Error('Unexpected ledger data. Check the database destination.')
      }
      return state
    },
    async save(state) {
      await request({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedAt: new Date().toISOString(), state }),
      })
    },
  }
}
