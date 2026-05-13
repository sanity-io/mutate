import {
  type InsertIfMissingOp,
  type InsertOp,
  type KeyedPathElement,
  type RelativePosition,
  type RemoveOp,
  type ReplaceOp,
  type TruncateOp,
  type UpsertOp,
} from '../../../mutations/operations/types'
import {MissingArrayItemError, TypeMismatchError} from '../../errors'
import {findTargetIndex, getTargetIdx, splice} from '../../utils/array'

export function insert<
  O extends InsertOp<unknown[], RelativePosition, number | KeyedPathElement>,
  CurrentValue extends unknown[],
>(op: O, currentValue: CurrentValue) {
  if (!Array.isArray(currentValue)) {
    return new TypeMismatchError({
      operation: 'insert',
      expectedType: 'array',
      actualType: typeof currentValue,
    })
  }

  const index = findTargetIndex(currentValue, op.referenceItem)
  if (index instanceof Error) return index
  if (index === null) {
    return new MissingArrayItemError({operation: `insert ${op.position}`})
  }
  // special case for empty arrays
  if (currentValue.length === 0) {
    return op.items
  }
  return splice(currentValue, getTargetIdx(op.position, index), 0, op.items)
}

export function upsert<
  O extends UpsertOp<{_key: string}[], RelativePosition, KeyedPathElement>,
  CurrentValue extends unknown[],
>(op: O, currentValue: CurrentValue) {
  if (!Array.isArray(currentValue)) {
    return new TypeMismatchError({
      operation: 'upsert',
      expectedType: 'array',
      actualType: typeof currentValue,
    })
  }

  if (op.items.length === 0) {
    return currentValue
  }
  const replaceItemsMap: Record<number, number> = {}
  const insertItems: unknown[] = []
  op.items.forEach((itemToBeUpserted: any, i) => {
    const existingIndex = currentValue.findIndex(
      existingItem => (existingItem as any)?._key === itemToBeUpserted._key,
    )
    if (existingIndex >= 0) {
      replaceItemsMap[existingIndex] = i
    } else {
      insertItems.push(itemToBeUpserted)
    }
  })

  const itemsToReplace = Object.keys(replaceItemsMap)
  if (itemsToReplace.length === 0 && insertItems.length == 0) {
    return currentValue
  }

  const next = [...currentValue]
  // Replace existing items
  for (const i of itemsToReplace) {
    const index = Number(i)
    next[index] = op.items[replaceItemsMap[index]!]!
  }

  // Insert the items that doesn't exist
  return insert(
    {
      type: 'insert',
      items: insertItems,
      referenceItem: op.referenceItem,
      position: op.position,
    },
    next,
  )
}
export function insertIfMissing<
  O extends InsertIfMissingOp<
    {_key: string}[],
    RelativePosition,
    KeyedPathElement
  >,
  CurrentValue extends unknown[],
>(op: O, currentValue: CurrentValue) {
  if (!Array.isArray(currentValue)) {
    return new TypeMismatchError({
      operation: 'insertIfMissing',
      expectedType: 'array',
      actualType: typeof currentValue,
    })
  }

  if (op.items.length === 0) {
    return currentValue
  }
  const itemsToInsert = op.items.filter(
    item =>
      !currentValue.find(existing => item._key === (existing as any)?._key),
  )

  if (itemsToInsert.length === 0) {
    return currentValue
  }

  // Insert the items that doesn't exist
  return insert(
    {
      type: 'insert',
      items: itemsToInsert,
      referenceItem: op.referenceItem,
      position: op.position,
    },
    currentValue,
  )
}

export function replace<
  O extends ReplaceOp<unknown[], number | KeyedPathElement>,
  CurrentValue extends unknown[],
>(op: O, currentValue: CurrentValue) {
  if (!Array.isArray(currentValue)) {
    return new TypeMismatchError({
      operation: 'replace',
      expectedType: 'array',
      actualType: typeof currentValue,
    })
  }

  const index = findTargetIndex(currentValue, op.referenceItem)
  if (index instanceof Error) return index
  if (index === null) {
    return new MissingArrayItemError({operation: 'replace'})
  }
  return splice(currentValue, index, op.items.length, op.items)
}
export function remove<
  O extends RemoveOp<number | KeyedPathElement>,
  CurrentValue extends unknown[],
>(op: O, currentValue: CurrentValue) {
  if (!Array.isArray(currentValue)) {
    return new TypeMismatchError({
      operation: 'remove',
      expectedType: 'array',
      actualType: typeof currentValue,
    })
  }

  const index = findTargetIndex(currentValue, op.referenceItem)
  if (index instanceof Error) return index
  if (index === null) {
    return new MissingArrayItemError({operation: 'remove'})
  }
  return splice(currentValue, index, 1, [])
}

export function truncate<O extends TruncateOp, CurrentValue extends unknown[]>(
  op: O,
  currentValue: CurrentValue,
) {
  if (!Array.isArray(currentValue)) {
    return new TypeMismatchError({
      operation: 'truncate',
      expectedType: 'array',
      actualType: typeof currentValue,
    })
  }

  return typeof op.endIndex === 'number'
    ? currentValue
        .slice(0, op.startIndex)
        .concat(currentValue.slice(op.endIndex))
    : currentValue.slice(0, op.startIndex)
}
