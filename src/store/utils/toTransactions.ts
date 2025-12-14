import {type Transaction} from '../../mutations/types'
import {type MutationGroup} from '../types'
import {createTransactionId} from './createTransactionId'

/**
 * Converts a list of mutation groups into a list of transactions, assigning an ID to each.
 * @param groups
 */
export function toTransactions(groups: MutationGroup[]): Transaction[] {
  return groups.map(group => {
    if (group.transaction && group.id !== undefined) {
      return {id: group.id!, mutations: group.mutations}
    }
    return {id: createTransactionId(), mutations: group.mutations}
  })
}
