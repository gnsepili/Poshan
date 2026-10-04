import { invokeEdgeFunction } from '../../lib/api/edgeFunction'
import { AI_LIMIT_MESSAGE } from '../../lib/utils/rateLimit'

jest.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) } },
}))

const respond = (status: number, text: string) =>
  jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, text: async () => text })

describe('invokeEdgeFunction', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
    jest.useRealTimers()
  })

  it('POSTs JSON with the session token and returns the parsed body', async () => {
    const fetchMock = respond(200, '{"reply":"hi"}')
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(invokeEdgeFunction<{ reply: string }>('ai-agent', { message: 'x' })).resolves.toEqual({ reply: 'hi' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/functions\/v1\/ai-agent$/)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body)).toEqual({ message: 'x' })
  })

  it('uses the server error message on a non-ok JSON response', async () => {
    globalThis.fetch = respond(400, '{"error":"Message is too long."}') as unknown as typeof fetch
    await expect(invokeEdgeFunction('ai-agent', {})).rejects.toThrow('Message is too long.')
  })

  it('maps 429 to the friendly AI-limit message', async () => {
    globalThis.fetch = respond(429, '{"error":"whatever"}') as unknown as typeof fetch
    await expect(invokeEdgeFunction('ai-agent', {})).rejects.toThrow(AI_LIMIT_MESSAGE)
  })

  it('maps 401 to a sign-in-again message', async () => {
    globalThis.fetch = respond(401, '{"error":"Unauthorized"}') as unknown as typeof fetch
    await expect(invokeEdgeFunction('ai-agent', {})).rejects.toThrow(/sign in again/i)
  })

  it('never surfaces a JSON parse error for an HTML gateway error page', async () => {
    globalThis.fetch = respond(502, '<html>Bad Gateway</html>') as unknown as typeof fetch
    await expect(invokeEdgeFunction('ai-agent', {})).rejects.toThrow(/something went wrong on our side/i)
  })

  it('reports a network failure as a connectivity problem', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch
    await expect(invokeEdgeFunction('ai-agent', {})).rejects.toThrow(/check your connection/i)
  })

  it('aborts after the timeout with a friendly message', async () => {
    jest.useFakeTimers()
    globalThis.fetch = jest.fn((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })))
      })
    ) as unknown as typeof fetch
    const pending = invokeEdgeFunction('ai-agent', {}, { timeoutMs: 1000 })
    const assertion = expect(pending).rejects.toThrow(/taking longer than usual/i)
    await jest.advanceTimersByTimeAsync(1001)
    await assertion
  })
})
