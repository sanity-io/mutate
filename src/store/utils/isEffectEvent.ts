export function hasProperty<T, P extends keyof T>(
  value: T,
  property: P,
): value is T & Required<Pick<T, P>> {
  const val = value[property]
  return typeof val !== 'undefined' && val !== null
}
