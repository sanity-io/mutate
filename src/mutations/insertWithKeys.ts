import {isObject} from '../utils/isObject'
import {insert} from './operations/creators'
import {type RelativePosition} from './operations/types'
import type {Index, KeyedPathElement} from '../path'

export function insertWithKeys<
  Pos extends RelativePosition,
  Ref extends Index | KeyedPathElement,
  Item,
>(generateKey: () => string) {
  const ensureKeys = createEnsureKeys(generateKey)
  return (pos: Pos, ref: Ref, items: Item[]) =>
    insert(ensureKeys(items), pos, ref)
}

function hasKey<T extends object>(item: T): item is T & {_key: string} {
  return '_key' in item
}

function createEnsureKeys<T>(generateKey: () => string) {
  return (array: T[]): T[] => {
    let didModify = false
    const withKeys = array.map(item => {
      if (needsKey(item)) {
        didModify = true
        return {...item, _key: generateKey()}
      }
      return item
    })
    return didModify ? withKeys : array
  }
}

function needsKey(arrayItem: any): arrayItem is object {
  return isObject(arrayItem) && !hasKey(arrayItem)
}
