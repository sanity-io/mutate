import type {SanityMutation} from '../encoders/sanity'
import type {SanityDocumentBase} from '../mutations/types'

export type SanityMutationEvent = {
  type: 'mutation'
  documentId: string
  eventId: string
  identity: string
  mutations: SanityMutation[]
  previousRev?: string
  resultRev?: string
  result?: SanityDocumentBase
  previous?: SanityDocumentBase | null
  effects?: {apply: unknown[]; revert: unknown[]}
  timestamp: string
  transactionId: string
  transition: 'update' | 'appear' | 'disappear'
  visibility: 'query' | 'transaction'
}
