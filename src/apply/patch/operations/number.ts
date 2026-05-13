import {type DecOp, type IncOp} from '../../../mutations/operations/types'
import {TypeMismatchError} from '../../errors'

export function inc<O extends IncOp<number>, CurrentValue extends number>(
  op: O,
  currentValue: CurrentValue,
) {
  if (typeof currentValue !== 'number') {
    return new TypeMismatchError({
      operation: 'inc',
      expectedType: 'number',
      actualType: typeof currentValue,
    })
  }

  return currentValue + op.amount
}

export function dec<O extends DecOp<number>, CurrentValue extends number>(
  op: O,
  currentValue: CurrentValue,
) {
  if (typeof currentValue !== 'number') {
    return new TypeMismatchError({
      operation: 'dec',
      expectedType: 'number',
      actualType: typeof currentValue,
    })
  }

  return currentValue - op.amount
}
