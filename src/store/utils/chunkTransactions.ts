import type {PendingTransaction} from '../types'

/**
 * Groups subsequent mutations into transactions, leaves transactions as-is
 * @param transactions
 */
export function chunkTransactions(
  transactions: PendingTransaction[],
): PendingTransaction[] {
  return chunkWhile(transactions, transaction => !transaction.id).flatMap(
    chunk => ({
      ...chunk[0],
      mutations: chunk.flatMap(c => c.mutations),
    }),
  )
}

/**
 * Groups subsequent mutations into transactions, leaves transactions as-is
 * @param arr
 * @param predicate
 */
export function chunkWhile<T>(
  arr: T[],
  predicate: (item: T) => boolean,
): T[][] {
  const res: T[][] = []
  let currentChunk: T[] = []
  arr.forEach(item => {
    if (predicate(item)) {
      currentChunk.push(item)
    } else {
      if (currentChunk.length > 0) {
        res.push(currentChunk)
      }
      currentChunk = []
      res.push([item])
    }
  })
  if (currentChunk.length > 0) {
    res.push(currentChunk)
  }
  return res
}
