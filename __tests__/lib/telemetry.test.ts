import { shapeError, logError, logEvent } from '../../lib/telemetry'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

const mockedFrom = supabase.from as jest.Mock

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
  beforeEach(() => mockedFrom.mockReset())

  it('inserts the shaped error into error_logs, scoped to the user', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logError('meal-log', new Error('kaboom'), 'user-1')
    expect(mockedFrom).toHaveBeenCalledWith('error_logs')
    expect(insert).toHaveBeenCalledWith({ context: 'meal-log', message: 'kaboom', stack: expect.any(String), user_id: 'user-1' })
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
  beforeEach(() => mockedFrom.mockReset())

  it('inserts the event name + props into events, scoped to the user', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logEvent('meal_logged', { meal_type: 'lunch' }, 'user-1')
    expect(mockedFrom).toHaveBeenCalledWith('events')
    expect(insert).toHaveBeenCalledWith({ name: 'meal_logged', props: { meal_type: 'lunch' }, user_id: 'user-1' })
  })

  it('defaults props to {} and user_id to null when omitted', async () => {
    const insert = jest.fn().mockResolvedValue({ error: null })
    mockedFrom.mockReturnValue({ insert })
    await logEvent('plan_generated')
    expect(insert).toHaveBeenCalledWith({ name: 'plan_generated', props: {}, user_id: null })
  })

  it('never throws when the insert call itself throws (best-effort)', async () => {
    mockedFrom.mockImplementation(() => {
      throw new Error('network down')
    })
    await expect(logEvent('meal_logged')).resolves.toBeUndefined()
  })
})
