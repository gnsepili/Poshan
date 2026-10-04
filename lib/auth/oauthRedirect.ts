// Parse the URL Supabase redirects back to after an OAuth sign-in. With the PKCE flow a
// success carries ?code=…; failures carry error/error_description in the query or fragment.
function parseParams(part: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pair of part.split('&')) {
    if (!pair) continue
    const [rawKey, rawValue = ''] = pair.split('=')
    out[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, ' '))
  }
  return out
}

export function parseAuthRedirect(url: string): { code: string } | { error: string } | null {
  const [beforeHash, hash = ''] = url.split('#')
  const query = parseParams(beforeHash.split('?')[1] ?? '')
  const fragment = parseParams(hash)
  const error = query.error_description || fragment.error_description || query.error || fragment.error
  if (error) return { error }
  return query.code ? { code: query.code } : null
}
