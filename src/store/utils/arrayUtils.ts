export function takeUntil<T>(
  arr: T[],
  predicate: (item: T) => boolean,
  opts?: {inclusive: boolean},
) {
  const result = []
  for (const item of arr) {
    if (predicate(item)) {
      if (opts?.inclusive) {
        result.push(item)
      }
      return result
    }
    result.push(item)
  }
  return result
}

export function takeUntilRight<T>(
  arr: T[],
  predicate: (item: T) => boolean,
  opts?: {inclusive: boolean},
) {
  const result = []
  for (const item of arr.slice().reverse()) {
    if (predicate(item)) {
      if (opts?.inclusive) {
        result.push(item)
      }
      return result
    }
    result.push(item)
  }
  return result.reverse()
}

export function partition<T>(
  arr: readonly T[],
  predicate: (item: T) => unknown,
): [truthy: T[], falsy: T[]] {
  const truthy: T[] = []
  const falsy: T[] = []
  for (const item of arr) {
    if (predicate(item)) {
      truthy.push(item)
    } else {
      falsy.push(item)
    }
  }
  return [truthy, falsy]
}

export function groupBy<T>(
  arr: readonly T[],
  getKey: (item: T) => string,
): Record<string, T[]> {
  const result: Record<string, T[]> = Object.create(null)
  for (const item of arr) {
    const key = getKey(item)
    const group = result[key]
    if (group) {
      group.push(item)
    } else {
      result[key] = [item]
    }
  }
  return result
}

export function keyBy<T>(
  arr: readonly T[],
  getKey: (item: T) => string,
): Record<string, T> {
  const result: Record<string, T> = Object.create(null)
  for (const item of arr) {
    result[getKey(item)] = item
  }
  return result
}

/**
 * Lowest index at which `value` can be inserted into the sorted `arr` while keeping it sorted
 */
export function sortedIndex<T extends string | number>(
  arr: readonly T[],
  value: T,
): number {
  let low = 0
  let high = arr.length
  while (low < high) {
    const mid = (low + high) >>> 1
    if (arr[mid]! < value) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}
