import {type SanityClient} from '@sanity/client'
import {SanityEncoder, type Transaction} from '@sanity/mutate'
import {fromPromise} from 'xstate'

export function defineSubmitTransactions({client}: {client: SanityClient}) {
  return fromPromise(
    async ({
      input,
      signal,
    }: {
      input: {transactions: Transaction[]}
      signal: AbortSignal
    }) => {
      for (const transaction of input.transactions) {
        if (signal.aborted) return
        await client
          .dataRequest('mutate', SanityEncoder.encodeTransaction(transaction), {
            visibility: 'async',
            returnDocuments: false,
            signal,
          })
          .catch(e => {
            if (e instanceof Error && e.name === 'AbortError') return
            throw e
          })
      }
    },
  )
}
export type SubmitTransactionsMachine = ReturnType<
  typeof defineSubmitTransactions
>
