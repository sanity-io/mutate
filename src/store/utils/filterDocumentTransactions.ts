import {type Mutation, type Transaction} from '../../mutations/types'
import {getMutationDocumentId} from './getMutationDocumentId'

export function filterDocumentTransactions(
  transactions: readonly Transaction[],
  id: string,
): Mutation[] {
  return transactions.flatMap(transaction =>
    transaction.mutations.flatMap(mut =>
      getMutationDocumentId(mut) === id ? [mut] : [],
    ),
  )
}
