import {arrify} from '../../utils/arrify'
import type {Index, KeyedPathElement} from '../../path'
import type {
  AssignOp,
  DecOp,
  DiffMatchPatchOp,
  IncOp,
  InsertOp,
  RelativePosition,
  ReplaceOp,
  SetIfMissingOp,
  SetOp,
  TruncateOp,
  UnassignOp,
  UnsetOp,
  UpsertOp,
} from './types'

export const set = <const T>(value: T): SetOp<T> => ({type: 'set', value})

export const assign = <const T extends object>(value: T): AssignOp<T> => ({
  type: 'assign',
  value,
})

export const unassign = <const K extends readonly string[]>(
  keys: K,
): UnassignOp<K> => ({
  type: 'unassign',
  keys,
})

export const setIfMissing = <const T>(value: T): SetIfMissingOp<T> => ({
  type: 'setIfMissing',
  value,
})

export const unset = (): UnsetOp => ({type: 'unset'})

export const inc = <const N extends number = 1>(
  amount: N = 1 as N,
): IncOp<N> => ({
  type: 'inc',
  amount,
})

export const dec = <const N extends number = 1>(
  amount: N = 1 as N,
): DecOp<N> => ({
  type: 'dec',
  amount,
})

export const diffMatchPatch = (value: string): DiffMatchPatchOp => ({
  type: 'diffMatchPatch',
  value,
})

export const insert = <
  Item,
  Pos extends RelativePosition,
  ReferenceItem extends Index | KeyedPathElement,
>(
  items: Item | Item[],
  position: Pos,
  referenceItem: ReferenceItem,
): InsertOp<Item, Pos, ReferenceItem> => ({
  type: 'insert',
  referenceItem,
  position,
  items: arrify(items) as Item[],
})

export const append = <Item>(items: Item | Item[]) =>
  insert(items, 'after' as const, -1 as const)

export const prepend = <Item>(items: Item | Item[]) =>
  insert(items, 'before' as const, 0 as const)

export const insertBefore = <
  Item,
  ReferenceItem extends Index | KeyedPathElement,
>(
  items: Item | Item[],
  referenceItem: ReferenceItem,
) => insert(items, 'before' as const, referenceItem)

export const insertAfter = <
  Item,
  ReferenceItem extends Index | KeyedPathElement,
>(
  items: Item | Item[],
  referenceItem: ReferenceItem,
) => insert(items, 'after' as const, referenceItem)

export function truncate(startIndex: number, endIndex?: number): TruncateOp {
  return {
    type: 'truncate',
    startIndex,
    endIndex,
  }
}

/*
  Use this when you know the ref item already exists
 */
export function replace<Item, ReferenceItem extends Index | KeyedPathElement>(
  items: Item | Item[],
  referenceItem: ReferenceItem,
): ReplaceOp<Item, ReferenceItem> {
  return {
    type: 'replace',
    referenceItem,
    items: arrify(items) as Item[],
  }
}

/*
use this when the reference item may or may not exist
 */
export function upsert<
  Item,
  ReferenceItem extends Index | KeyedPathElement,
  Pos extends RelativePosition,
>(
  items: Item | Item[],
  position: Pos,
  referenceItem: ReferenceItem,
): UpsertOp<Item, Pos, ReferenceItem> {
  return {
    type: 'upsert',
    items: arrify(items) as Item[],
    referenceItem,
    position,
  }
}
