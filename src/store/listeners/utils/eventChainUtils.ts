export function discardChainTo<T extends {resultRev?: string}>(
  chain: T[],
  revision: string | undefined,
) {
  const revisionIndex = chain.findIndex(event => event.resultRev === revision)

  return split(chain, revisionIndex + 1)
}

function split<T>(array: T[], index: number): [T[], T[]] {
  if (index < 0) {
    return [[], array]
  }
  return [array.slice(0, index), array.slice(index)]
}

export function toOrderedChains<
  T extends {previousRev?: string; resultRev?: string},
>(events: T[]) {
  const parents: Record<string, T | undefined> = {}

  events.forEach(event => {
    parents[event.resultRev || 'undefined'] = events.find(
      other => other.resultRev === event.previousRev,
    )
  })

  // get entries without a parent (if there's more than one, we have a problem)
  const orphans = Object.entries(parents).filter(([, parent]) => {
    return !parent
  })!

  return orphans.map(orphan => {
    const [headRev] = orphan

    let current = events.find(event => event.resultRev === headRev)

    const sortedList: T[] = []
    while (current) {
      sortedList.push(current)

      current = events.find(event => event.previousRev === current?.resultRev)
    }
    return sortedList
  })
}
