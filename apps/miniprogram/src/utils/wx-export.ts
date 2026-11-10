export function pickFn<T>(named: unknown, fallback: unknown, name: string): T {
  if (typeof named === 'function') {
    return named as T
  }
  if (typeof fallback === 'function') {
    return fallback as T
  }
  if (fallback && typeof fallback === 'object') {
    const rec = fallback as Record<string, unknown>
    const inner = rec[name] ?? rec.default
    if (typeof inner === 'function') {
      return inner as T
    }
  }
  throw new Error(`${name} is not a function`)
}
