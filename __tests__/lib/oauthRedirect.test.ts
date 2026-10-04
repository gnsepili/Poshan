import { parseAuthRedirect } from '../../lib/auth/oauthRedirect'

describe('parseAuthRedirect', () => {
  it('extracts the PKCE code from the query string', () => {
    expect(parseAuthRedirect('poshanai://auth-callback?code=abc-123')).toEqual({ code: 'abc-123' })
  })

  it('surfaces a provider error description (query or fragment), decoded', () => {
    expect(parseAuthRedirect('poshanai://auth-callback?error=access_denied&error_description=User+cancelled%20login')).toEqual({
      error: 'User cancelled login',
    })
    expect(parseAuthRedirect('poshanai://auth-callback#error=server_error&error_description=Unable%20to%20exchange')).toEqual({
      error: 'Unable to exchange',
    })
  })

  it('falls back to the error code when there is no description', () => {
    expect(parseAuthRedirect('poshanai://auth-callback?error=access_denied')).toEqual({ error: 'access_denied' })
  })

  it('returns null when the redirect carries neither a code nor an error', () => {
    expect(parseAuthRedirect('poshanai://auth-callback')).toBeNull()
  })
})
