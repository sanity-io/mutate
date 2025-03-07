import {type Mutation, type Transaction} from '../../mutations/types'
import {getMutationDocumentId} from './getMutationDocumentId'

export function filterDocumentTransactions(
  transactions: Transaction[],
  documentId: string,
): Mutation[] {
  return transactions.flatMap(transaction =>
    transaction.mutations.flatMap(mut =>
      getMutationDocumentId(mut) === documentId ? [mut] : [],
    ),
  )
}
