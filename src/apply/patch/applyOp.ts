import * as operations from './operations'
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
  UpsertOp,
} from '../../mutations/operations/types'

import type {ApplyOp} from './typings/applyOp'

export type SimpleObject = {
  [K in string]: any
}

export type AnyOp = SetOp<any> | SetIfMissingOp<any> | UnsetOp
export type NumberOps = IncOp<any> | DecOp<any>
export type StringOps = DiffMatchPatchOp
export type ObjectOps = AssignOp<SimpleObject> | UnassignOp<any>
export type ArrayOps =
  | InsertOp<any, any, any>
  | UpsertOp<any, any, any>
  | ReplaceOp<any, any>

export type ValidArgForOp<O extends Operation> = O extends AnyOp
  ? any
  : O extends NumberOps
  ? number
  : O extends StringOps
  ? string
  : O extends ObjectOps
  ? {[k in keyof any]: unknown}
  : O extends ArrayOps
  ? any[]
  : never

export function applyOp<
  const Op extends Operation,
  const CurrentValue extends ValidArgForOp<Op>,
>(op: Op, currentValue: CurrentValue): ApplyOp<Op, CurrentValue> {
  if (!(op.type in operations)) {
    throw new Error(`Invalid operation type: "${op.type}"`)
  }

  return (operations[op.type] as CallableFunction)(op, currentValue)
}
