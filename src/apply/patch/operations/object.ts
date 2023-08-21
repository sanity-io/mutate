import {isEmpty} from '../../utils/isEmpty'
import {omit} from '../../utils/omit'
import type {AssignOp, UnassignOp} from '../../../mutations/operations/types'

export function unassign<T extends object, K extends (keyof T)[]>(
  op: UnassignOp<K>,
  value: T,
) {
  return op.keys.length === 0 ? value : omit(value, op.keys as any[])
}

export function assign<T extends object, K extends (keyof T)[]>(
  op: AssignOp<T>,
  value: T,
) {
  return isEmpty(op.value) ? value : {...value, ...op.value}
}
