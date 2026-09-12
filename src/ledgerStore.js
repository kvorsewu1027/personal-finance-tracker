export function ledgerStorageKey(syncUrl = '', uid = '') {
  const base = 'personal-expense-tracker-state'
  return syncUrl ? `${base}:${syncUrl}:${uid}` : base
}

// Serialize requests and retain pending edits across refreshes and failed saves.
export function createLedgerStore({ storage, key, initialState, sanitize, remote }) {
  let cached
  try { cached = JSON.parse(storage.getItem(key)) } catch { /* Start empty. */ }
  let dirty = Boolean(remote && cached?.pending)
  let revision = 0
  let generation = 0
  let timer
  let busy = false
  let running = false
  const listeners = new Set()
  let snapshot = {
    state: sanitize(cached?.state || cached || initialState),
    ready: !remote || Boolean(cached),
    status: remote ? 'Connecting to personal database…' : 'Changes are saved automatically in this browser.',
    error: false,
    pending: dirty,
  }
  function emit(changes) {
    snapshot = { ...snapshot, ...changes }
    listeners.forEach((listener) => listener())
  }
  function persist() {
    try {
      storage.setItem(key, JSON.stringify(remote
        ? { state: snapshot.state, pending: dirty }
        : snapshot.state))
      return true
    } catch {
      emit({ error: true, status: 'Browser storage is unavailable. Keep this page open and export your expenses.' })
      return false
    }
  }
  function schedule(delay) {
    clearTimeout(timer)
    if (running && remote) timer = setTimeout(sync, delay)
  }
  async function sync() {
    if (!running || !remote || busy) return
    busy = true
    const currentGeneration = generation
    const currentRevision = revision
    const isCurrent = () => running && generation === currentGeneration
    try {
      if (dirty) {
        emit({ status: 'Saving to personal database…', error: false })
        await remote.save(snapshot.state)
        if (!isCurrent()) return
        // Edits made during a save must be sent in a subsequent request.
        dirty = revision !== currentRevision
        emit({ ready: true, pending: dirty, error: false, status: dirty ? 'Changes waiting to sync…' : 'Personal database is up to date.' })
        persist()
      } else {
        const state = await remote.load()
        if (!isCurrent() || revision !== currentRevision) return
        if (state === null) {
          // This scoped cache never reads the household or local-only cache.
          dirty = true
          emit({ ready: true, pending: true, error: false, status: 'Creating your personal ledger…' })
        } else {
          emit({ state: sanitize(state), ready: true, error: false, status: 'Personal database is up to date.' })
        }
        persist()
      }
    } catch {
      if (isCurrent()) emit({ error: true, status: 'Personal database unavailable. Retrying automatically; pending edits stay on this device.' })
    } finally {
      if (isCurrent()) {
        busy = false
        schedule(snapshot.error ? 10000 : dirty ? 450 : 10000)
      }
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    update(change) {
      const next = typeof change === 'function' ? change(snapshot.state) : change
      if (next === snapshot.state) return
      revision += 1
      dirty = Boolean(remote)
      emit({ state: sanitize(next), pending: dirty,
        ...(remote ? { status: 'Changes waiting to sync…' } : {}) })
      persist()
      schedule(450)
    },
    start() {
      running = true
      generation += 1
      busy = false
      if (remote) void sync()
      return () => { running = false; generation += 1; clearTimeout(timer) }
    },
    retry: sync,
  }
}
