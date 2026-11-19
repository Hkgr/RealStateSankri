import assert from 'node:assert/strict'
import { test } from 'node:test'
import { basicAuth, documentsEnabled } from '../src/documents.js'

test('documents are off unless the site is protected or opened on purpose', () => {
  assert.equal(documentsEnabled({}), false)
  assert.equal(documentsEnabled({ BASIC_AUTH_USER: 'a' }), false, 'a user without a password is not protection')
  assert.equal(documentsEnabled({ BASIC_AUTH_USER: 'a', BASIC_AUTH_PASSWORD: 'b' }), true)
  assert.equal(documentsEnabled({ DOCS_OPEN: '1' }), true)
  assert.equal(documentsEnabled({ DOCS_OPEN: 'true' }), false)
})

function run(middleware, { path = '/', authorization } = {}) {
  const out = { status: null, headers: {}, nextCalled: false }
  const res = {
    set(name, value) {
      out.headers[name] = value
      return res
    },
    status(code) {
      out.status = code
      return res
    },
    send() {
      return res
    },
  }
  middleware({ path, headers: { authorization } }, res, () => (out.nextCalled = true))
  return out
}
const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`

test('basic auth lets the right credentials in and asks the others to sign in', () => {
  const guard = basicAuth('sankari', 'p:ass word')
  assert.equal(run(guard, { authorization: basic('sankari', 'p:ass word') }).nextCalled, true, 'a password may contain a colon and spaces')
  const wrong = run(guard, { authorization: basic('sankari', 'nope') })
  assert.equal(wrong.nextCalled, false)
  assert.equal(wrong.status, 401)
  assert.match(wrong.headers['WWW-Authenticate'], /^Basic realm=/)
  assert.equal(run(guard, { authorization: basic('other', 'p:ass word') }).status, 401)
  assert.equal(run(guard).status, 401, 'no credentials')
  assert.equal(run(guard, { authorization: 'Bearer abc' }).status, 401, 'other schemes')
})

test('the health check stays open for monitoring', () => {
  assert.equal(run(basicAuth('a', 'b'), { path: '/api/v1/health' }).nextCalled, true)
  assert.equal(run(basicAuth('a', 'b'), { path: '/api/v1/overview' }).nextCalled, false)
})
