import type {DecOp, IncOp} from '../../../mutations/operations/types'

export function inc<O extends IncOp<number>, CurrentValue extends number>(
  op: O,
  currentValue: CurrentValue,
) {
  return currentValue + op.amount
}

export function dec<O extends DecOp<number>, CurrentValue extends number>(
  op: O,
  currentValue: CurrentValue,
) {
  return currentValue - op.amount
}
