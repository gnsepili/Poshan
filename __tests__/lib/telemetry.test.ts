import { shapeError, logError, logEvent } from '../../lib/telemetry'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}))

const mockedFrom = supabase.from as jest.Mock
const mockedGetSession = supabase.auth.getSession as jest.Mock

function mockSession(userId: string | null) {
  mockedGetSession.mockResolvedValue({ data: { session: userId ? { user: { id: userId } } : null } })
}

describe('shapeError', () => {
  it('extracts message + stack from an Error and keeps the context', () => {
    const err = new Error('kaboom')
    const shaped = shapeError('meal-log', err)
    expect(shaped.context).toBe('meal-log')
    expect(shaped.message).toBe('kaboom')
    expect(typeof shaped.stack).toBe('string')
  })
  it('stringifies a non-Error and returns a null stack', () => {
    expect(shapeError('ctx', 'plain string')).toEqual({ context: 'ctx', message: 'plain string', stack: null })
  })
})

describe('logError', () => {
  beforeEach(() => {
    mockedFrom.mockReset()
    mockedGetSession.mockReset()
  })

  it('inserts the shaped error into error_logs, scoped to an explicitly-passed user id (no session lookup)', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logError('meal-log', new Error('kaboom'), 'user-1')
    expect(mockedFrom).toHaveBeenCalledWith('error_logs')
    expect(insert).toHaveBeenCalledWith({ context: 'meal-log', message: 'kaboom', stack: expect.any(String), user_id: 'user-1' })
    expect(mockedGetSession).not.toHaveBeenCalled()
  })

  it('derives the user id from the current session when none is passed (required for RLS to accept the insert)', async () => {
    mockSession('session-user-1')
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logError('meal-log', new Error('kaboom'))
    expect(insert).toHaveBeenCalledWith({ context: 'meal-log', message: 'kaboom', stack: expect.any(String), user_id: 'session-user-1' })
  })

  it('falls back to null when there is no session (signed out — RLS will reject, swallowed like any other failure)', async () => {
    mockSession(null)
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logError('meal-log', new Error('kaboom'))
    expect(insert).toHaveBeenCalledWith({ context: 'meal-log', message: 'kaboom', stack: expect.any(String), user_id: null })
  })

  it('never throws when getSession itself rejects (best-effort session lookup)', async () => {
    mockedGetSession.mockRejectedValue(new Error('session lookup failed'))
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await expect(logError('meal-log', new Error('kaboom'))).resolves.toBeUndefined()
    expect(insert).toHaveBeenCalledWith({ context: 'meal-log', message: 'kaboom', stack: expect.any(String), user_id: null })
  })

  it('never throws when the insert call itself throws (best-effort)', async () => {
    mockedFrom.mockImplementation(() => {
      throw new Error('network down')
    })
    await expect(logError('meal-log', new Error('kaboom'))).resolves.toBeUndefined()
  })

  it('never throws when the insert rejects', async () => {
    const insert = jest.fn().mockRejectedValue(new Error('insert failed'))
    mockedFrom.mockReturnValue({ insert })
    await expect(logError('meal-log', new Error('kaboom'))).resolves.toBeUndefined()
  })
})

describe('logEvent', () => {
  beforeEach(() => {
    mockedFrom.mockReset()
    mockedGetSession.mockReset()
  })

  it('inserts the event name + props into events, scoped to an explicitly-passed user id (no session lookup)', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logEvent('meal_logged', { meal_type: 'lunch' }, 'user-1')
    expect(mockedFrom).toHaveBeenCalledWith('events')
    expect(insert).toHaveBeenCalledWith({ name: 'meal_logged', props: { meal_type: 'lunch' }, user_id: 'user-1' })
    expect(mockedGetSession).not.toHaveBeenCalled()
  })

  it('derives the user id from the current session when none is passed', async () => {
    mockSession('session-user-2')
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logEvent('plan_generated', { kind: 'meal' })
    expect(insert).toHaveBeenCalledWith({ name: 'plan_generated', props: { kind: 'meal' }, user_id: 'session-user-2' })
  })

  it('defaults props to {} and user_id to null when omitted and there is no session', async () => {
    mockSession(null)
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logEvent('plan_generated')
    expect(insert).toHaveBeenCalledWith({ name: 'plan_generated', props: {}, user_id: null })
  })

  it('never throws when getSession itself rejects (best-effort session lookup)', async () => {
    mockedGetSession.mockRejectedValue(new Error('session lookup failed'))
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await expect(logEvent('meal_logged')).resolves.toBeUndefined()
    expect(insert).toHaveBeenCalledWith({ name: 'meal_logged', props: {}, user_id: null })
  })

  it('never throws when the insert call itself throws (best-effort)', async () => {
    mockedFrom.mockImplementation(() => {
      throw new Error('network down')
    })
    await expect(logEvent('meal_logged')).resolves.toBeUndefined()
  })
})
