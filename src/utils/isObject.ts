export function isObject(val: unknown): val is Record<keyof any, unknown> {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}
