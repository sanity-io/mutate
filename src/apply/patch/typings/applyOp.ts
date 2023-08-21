import type {
  AssignOp,
  DecOp,
  DiffMatchPatchOp,
  IncOp,
  InsertOp,
  Operation,
  ReplaceOp,
  SetIfMissingOp,
  SetOp,
  UnassignOp,
  UnsetOp,
} from '../../../mutations/operations/types'
import type {Apply, N} from 'hotscript'
import type {MergeObject} from '../../../utils/typeUtils'

type ArrayElement<A> = A extends readonly (infer T)[] ? T : never

export type ApplyOp<O extends Operation, Current> = Current extends never
  ? never
  : O extends SetOp<infer Next>
  ? Next
  : O extends UnsetOp
  ? undefined
  : O extends SetIfMissingOp<infer Next>
  ? Current extends undefined
    ? Next
    : Current
  : O extends IncOp<infer Amount>
  ? Current extends number
    ? Apply<N.Add, [Current, Amount]>
    : 'never'
  : O extends DecOp<infer Amount>
  ? Current extends number
    ? Apply<N.Sub, [Current, Amount]>
    : number
  : O extends InsertOp<infer Items, infer Pos, infer Ref>
  ? Current extends any[]
    ? (ArrayElement<Items> | ArrayElement<Current>)[]
    : never
  : O extends ReplaceOp<infer Items, infer Ref>
  ? Current extends any[]
    ? (ArrayElement<Items> | ArrayElement<Current>)[]
    : never
  : O extends AssignOp<infer K>
  ? MergeObject<Current & K>
  : O extends UnassignOp<infer K>
  ? Omit<Current, ArrayElement<K>>
  : O extends DiffMatchPatchOp
  ? string
  : never
