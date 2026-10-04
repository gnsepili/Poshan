// Utility groups where a later class must replace the default, not compete with it.
// (NativeWind resolves conflicting classes by stylesheet order, not by position in the
// string — e.g. `font-sans` beats `font-display` — so defaults are dropped explicitly.)
const GROUPS: RegExp[] = [
  /^font-(sans|display|display-semibold|medium|semibold|bold)$/,
  /^text-(xs|sm|base|lg|xl|[2-9]xl)$/,
  /^text-(foreground|muted-foreground|primary|accent|danger|success|warning|info|white|on-[\w-]+|macro-[\w-]+)$/,
]

function groupOf(cls: string): number {
  return GROUPS.findIndex((g) => g.test(cls))
}

export function mergeTextClasses(defaults: string, overrides: string): string {
  const overridden = new Set(overrides.split(/\s+/).filter(Boolean).map(groupOf).filter((g) => g >= 0))
  const kept = defaults.split(/\s+/).filter((cls) => cls && !overridden.has(groupOf(cls)))
  return [...kept, ...overrides.split(/\s+/).filter(Boolean)].join(' ')
}
