import {
  type AssignOp,
  type UnassignOp,
} from '../../../mutations/operations/types'
import {isObject} from '../../../utils/isObject'
import {TypeMismatchError} from '../../errors'
import {isEmpty} from '../../utils/isEmpty'
import {omit} from '../../utils/omit'

export function unassign<T extends object, K extends string[]>(
  op: UnassignOp<K>,
  currentValue: T,
) {
  if (!isObject(currentValue)) {
    return new TypeMismatchError({
      operation: 'unassign',
      expectedType: 'object',
      actualType: typeof currentValue,
    })
  }

  return op.keys.length === 0
    ? currentValue
    : omit(currentValue, op.keys as any[])
}

export function assign<T extends object>(op: AssignOp<T>, currentValue: T) {
  if (!isObject(currentValue)) {
    return new TypeMismatchError({
      operation: 'assign',
      expectedType: 'object',
      actualType: typeof currentValue,
    })
  }

  return isEmpty(op.value) ? currentValue : {...currentValue, ...op.value}
}
