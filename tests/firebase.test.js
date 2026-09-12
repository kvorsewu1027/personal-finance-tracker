import test from 'node:test'
import assert from 'node:assert/strict'
import { readFirebaseConfig } from '../src/firebaseConfig.js'
import { createLedgerStore, ledgerStorageKey } from '../src/ledgerStore.js'
import { personalDatabase } from '../src/personalDatabase.js'

const initialState = { expenses: [], budgetsByMonth: {}, selectedMonth: '2026-09' }
const changed = { ...initialState, expenses: [{ id: 'personal', amount: 5 }] }
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
function memoryStorage() {
  const data = new Map()
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) }
}
function setup(t, remote, storage = memoryStorage(), key = 'personal') {
  const store = createLedgerStore({ storage, key, initialState, sanitize: (x) => x, remote })
  t.after(store.start())
  return store
}

test('configuration is local-only when empty and fails closed for partial or unsafe destinations', () => {
  assert.equal(readFirebaseConfig({}).enabled, false)
  const env = {
    VITE_FIREBASE_API_KEY: 'web-key', VITE_FIREBASE_AUTH_DOMAIN: 'personal.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'personal', VITE_FIREBASE_ALLOWED_UIDS: 'owner',
    VITE_LEDGER_SYNC_URL: 'https://personal-default-rtdb.europe-west1.firebasedatabase.app/expenseTracker/main',
  }
  assert.equal(readFirebaseConfig(env).valid, true)
  assert.ok(readFirebaseConfig(env).syncUrl.endsWith('/main.json'))
  for (const patch of [
    { VITE_FIREBASE_API_KEY: '' }, { VITE_FIREBASE_ALLOWED_UIDS: 'one,two' },
    { VITE_LEDGER_SYNC_URL: 'https://example.com/expenseTracker/main' },
    { VITE_LEDGER_SYNC_URL: 'https://personal.firebaseio.com/' },
    { VITE_LEDGER_SYNC_URL: 'http://personal.firebaseio.com/expenseTracker/main' },
  ]) {
    const config = readFirebaseConfig({ ...env, ...patch })
    assert.equal(config.enabled, true)
    assert.equal(config.valid, false)
  }
})

test('cloud cache is isolated from household, local-only, other accounts and destinations', async (t) => {
  const storage = memoryStorage()
  for (const key of ['ledger-bloom-react-state', ledgerStorageKey(), ledgerStorageKey('other', 'owner'), ledgerStorageKey('personal', 'other')]) {
    storage.setItem(key, JSON.stringify(changed))
  }
  let saved
  const store = setup(t, { load: async () => null, save: async (state) => { saved = state } }, storage, ledgerStorageKey('personal', 'owner'))
  await settle()
  await store.retry()
  assert.deepEqual(saved, initialState)
})

test('existing cloud ledger loads without an initial overwrite', async (t) => {
  let writes = 0
  const store = setup(t, { load: async () => changed, save: async () => { writes++ } })
  await settle()
  assert.deepEqual(store.getSnapshot().state, changed)
  assert.equal(store.getSnapshot().ready, true)
  assert.equal(writes, 0)
})

test('failed saves retain pending data across reload and retry before reading remote data', async (t) => {
  const storage = memoryStorage()
  const store = setup(t, { load: async () => initialState, save: async () => { throw new Error('offline') } }, storage)
  await settle()
  store.update(changed)
  await store.retry()
  assert.equal(store.getSnapshot().error, true)
  assert.equal(JSON.parse(storage.getItem('personal')).pending, true)
  let saved
  let reads = 0
  const resumed = setup(t, { load: async () => { reads++; return initialState }, save: async (state) => { saved = state } }, storage)
  await settle()
  assert.deepEqual(saved, changed)
  assert.equal(reads, 0)
  assert.equal(resumed.getSnapshot().pending, false)
})

test('a cloud response cannot replace edits made while a refresh was in flight', async (t) => {
  let resolveRead
  let reads = 0
  const store = setup(t, {
    load: () => ++reads === 1 ? Promise.resolve(initialState) : new Promise((resolve) => { resolveRead = resolve }),
    save: async () => {},
  })
  await settle()
  const refresh = store.retry()
  store.update(changed)
  resolveRead(initialState)
  await refresh
  assert.deepEqual(store.getSnapshot().state, changed)
  assert.equal(store.getSnapshot().pending, true)
})

test('edits during a save remain pending for a second serialized save', async (t) => {
  let finishSave
  const writes = []
  const store = setup(t, { load: async () => initialState, save: (state) => {
    writes.push(state)
    return writes.length === 1 ? new Promise((resolve) => { finishSave = resolve }) : Promise.resolve()
  } })
  await settle()
  store.update(changed)
  const saving = store.retry()
  const newest = { ...changed, selectedMonth: '2026-10' }
  store.update(newest)
  await store.retry()
  assert.equal(writes.length, 1)
  finishSave()
  await saving
  assert.equal(store.getSnapshot().pending, true)
  await store.retry()
  assert.deepEqual(writes[1], newest)
  assert.equal(store.getSnapshot().pending, false)
})

test('late results after unmount/sign-out are ignored', async () => {
  let finishRead
  const store = createLedgerStore({ storage: memoryStorage(), key: 'personal', initialState, sanitize: (x) => x,
    remote: { load: () => new Promise((resolve) => { finishRead = resolve }), save: async () => {} } })
  const stop = store.start()
  stop()
  finishRead(changed)
  await settle()
  assert.deepEqual(store.getSnapshot().state, initialState)
  assert.equal(store.getSnapshot().ready, false)
})

test('REST requests use the personal destination, fresh ID tokens and compatible payloads', async () => {
  const requests = []
  let tokenNumber = 0
  const db = personalDatabase('https://personal.firebaseio.com/expenseTracker/main.json',
    { getIdToken: async () => `token-${++tokenNumber}` }, async (url, options) => {
      requests.push({ url, options })
      return { ok: true, json: async () => ({ state: changed }) }
    })
  assert.deepEqual(await db.load(), changed)
  await db.save(changed)
  assert.equal(new URL(requests[0].url).searchParams.get('auth'), 'token-1')
  assert.equal(new URL(requests[1].url).searchParams.get('auth'), 'token-2')
  assert.equal(requests[1].options.method, 'PUT')
  assert.deepEqual(JSON.parse(requests[1].options.body).state, changed)
  assert.ok(JSON.parse(requests[1].options.body).savedAt)
})

test('permission-denied reads do not seed or overwrite the database', async (t) => {
  let writes = 0
  const store = setup(t, { load: async () => { throw new Error('401') }, save: async () => { writes++ } })
  await settle()
  assert.equal(store.getSnapshot().ready, false)
  assert.equal(store.getSnapshot().error, true)
  assert.equal(writes, 0)
})
