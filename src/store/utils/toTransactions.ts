import {type Transaction} from '../../mutations/types'
import {type MutationGroup} from '../types'

/**
 * Assigns transaction IDs and
 * @param groups
 */
export function toTransactions(
  groups: MutationGroup[],
  options: {createTransactionId: () => string},
): Transaction[] {
  const {createTransactionId} = options
  return groups.map(group => {
    if (group.transaction && group.id !== undefined) {
      return {id: group.id!, mutations: group.mutations}
    }
    return {id: createTransactionId(), mutations: group.mutations}
  })
}
