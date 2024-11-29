import {type Transaction} from '../mutations/types'
import {type MutationGroup} from './types'

export function toTransactions(groups: MutationGroup[]): Transaction[] {
  return groups.map(group => {
    if (group.transaction && group.id !== undefined) {
      return {id: group.id!, mutations: group.mutations}
    }
    return {mutations: group.mutations}
  })
}
