import {isEmpty} from '../../utils/isEmpty'
import {findTargetIndex, getTargetIdx, splice} from '../../utils/array'
import type {
  InsertOp,
  ReplaceOp,
  TruncateOp,
  UpsertOp,
} from '../../../mutations/operations/types'

export function insert<
  O extends InsertOp<any, any, any>,
  CurrentValue extends any[],
>(op: O, currentValue: CurrentValue) {
  const index = findTargetIndex(currentValue, op.referenceItem)
  if (index === null) {
    throw new Error(`Found no matching array element to insert ${op.position}`)
  }
  // special case for empty arrays
  if (currentValue.length === 0) {
    return op.items
  }
  return splice(currentValue, getTargetIdx(op.position, index), 0, op.items)
}

export function upsert<
  O extends UpsertOp<any, any, any>,
  CurrentValue extends any[],
>(op: O, currentValue: CurrentValue) {
  if (op.items.length === 0) {
    return currentValue
  }
  const replaceItemsMap: number[] = []
  const insertItems: any[] = []
  op.items.forEach((itemToBeUpserted, i) => {
    const existingIndex = currentValue.findIndex(
      existingItem => (existingItem as any)?._key === itemToBeUpserted._key,
    )
    if (existingIndex >= 0) {
      replaceItemsMap[existingIndex] = i
    } else {
      insertItems.push(itemToBeUpserted)
    }
  })

  if (replaceItemsMap.length === 0 && insertItems.length == 0) {
    return currentValue
  }

  const next = [...currentValue]
  // Replace existing items
  for (const i of replaceItemsMap) {
    next[i] = op.items[replaceItemsMap[i]!]!
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

export function replace<
  O extends ReplaceOp<any, any>,
  CurrentValue extends any[],
>(op: O, currentValue: CurrentValue) {
  const index = findTargetIndex(currentValue, op.referenceItem)
  if (index === null) {
    throw new Error(`Found no matching array element to replace`)
  }
  return splice(currentValue, index, op.items.length, op.items)
}

export function truncate<O extends TruncateOp, CurrentValue extends any[]>(
  op: O,
  currentValue: CurrentValue,
) {
  return typeof op.endIndex === 'number'
    ? currentValue
        .slice(0, op.startIndex)
        .concat(currentValue.slice(op.endIndex))
    : currentValue.slice(0, op.startIndex)
}
