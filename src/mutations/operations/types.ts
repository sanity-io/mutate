import type {Index, KeyedPathElement} from '../../path'

export {Index, KeyedPathElement}

export type SetOp<T> = {
  type: 'set'
  value: T
}

export type UnsetOp = {
  type: 'unset'
}

export type SetIfMissingOp<T> = {
  type: 'setIfMissing'
  value: T
}

export type IncOp<Amount extends number> = {
  type: 'inc'
  amount: Amount
}

export type DecOp<Amount extends number> = {
  type: 'dec'
  amount: Amount
}

export type RelativePosition = 'before' | 'after'

export type InsertOp<
  Item,
  Pos extends RelativePosition,
  ReferenceItem extends Index | KeyedPathElement | Item,
> = {
  type: 'insert'
  referenceItem: ReferenceItem
  position: Pos
  items: Item[]
}

export type TruncateOp = {
  type: 'truncate'
  startIndex: number
  endIndex?: number
}
export type ReplaceOp<
  Item,
  ReferenceItem extends Index | KeyedPathElement | Item,
> = {
  type: 'replace'
  referenceItem: ReferenceItem
  items: Item[]
}
export type UpsertOp<
  Item,
  Pos extends RelativePosition,
  ReferenceItem extends Index | KeyedPathElement | Item,
> = {
  type: 'upsert'
  items: Item[]
  referenceItem: ReferenceItem
  position: Pos
}

export type AssignOp<T extends object> = {
  type: 'assign'
  value: T
}

export type UnassignOp<K extends readonly (keyof any)[]> = {
  type: 'unassign'
  keys: K
}

export type DiffMatchPatchOp = {
  type: 'diffMatchPatch'
  value: string
}

export type PrimitiveOp =
  | SetOp<any>
  | UnsetOp
  | SetIfMissingOp<any>
  | IncOp<any>
  | DecOp<any>
  | DiffMatchPatchOp

export type ArrayOp =
  | InsertOp<any, any, any>
  | UpsertOp<any, any, any>
  | ReplaceOp<any, any>
  | TruncateOp
export type ObjectOp = AssignOp<any> | UnassignOp<any>

export type Operation = PrimitiveOp | ArrayOp | ObjectOp
