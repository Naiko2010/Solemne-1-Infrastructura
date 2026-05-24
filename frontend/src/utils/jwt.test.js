import { describe, expect, it } from 'vitest'
import { getBusinessId, getBusinessIdFromToken, getUserRole } from './jwt'

function makeToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.signature`
}

describe('jwt helpers', () => {
  it('prioritizes app_metadata business_id from token', () => {
    const token = makeToken({
      app_metadata: { business_id: 'biz-app' },
      user_metadata: { business_id: 'biz-user' },
      business_id: 'biz-root',
    })

    expect(getBusinessIdFromToken(token)).toBe('biz-app')
  })

  it('uses session user business_id when JWT claim is missing', () => {
    const user = {
      app_metadata: { business_id: 'biz-user-app' },
      user_metadata: { business_id: 'biz-user-meta' },
    }
    const token = makeToken({})

    expect(getBusinessId(user, token)).toBe('biz-user-app')
  })

  it('prioritizes app_metadata role over user_metadata', () => {
    const user = {
      app_metadata: { role: 'superadmin' },
      user_metadata: { role: 'empleado' },
    }
    const token = makeToken({
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'cajero' },
      role: 'root-role',
    })

    expect(getUserRole(user, token)).toBe('superadmin')
  })
})
