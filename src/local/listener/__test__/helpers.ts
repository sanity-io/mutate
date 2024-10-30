import {type SanityMutation} from '../../../encoders/sanity'
import {type ListenerMutationEvent} from '../../types'

export function mutationEvent({
  previousRev,
  resultRev,
  mutations,
}: {
  previousRev: string
  resultRev: string
  mutations: SanityMutation[]
}) {
  return {
    type: 'mutation',
    documentId: 'test',
    transactionId: resultRev,
    effects: {apply: []},
    mutations,
    previousRev: previousRev,
    resultRev: resultRev,
    transition: 'update',
    identity: 'someone',
    transactionCurrentEvent: 1,
    transactionTotalEvents: 1,
    visibility: 'transaction',
  } satisfies ListenerMutationEvent
}
