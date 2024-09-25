import {
  type MutationEvent,
  type SanityClient,
  type SanityDocument,
} from '@sanity/client'
import {applyPatch, type RawPatch} from 'mendoza'
import {asapScheduler, defer, filter, observeOn} from 'rxjs'
import {
  assertEvent,
  assign,
  enqueueActions,
  fromEventObservable,
  fromPromise,
  raise,
  sendParent,
  setup,
  spawnChild,
  stopChild,
} from 'xstate'

import {encodeTransaction, type Mutation} from '../encoders/sanity'
import {
  type MutationGroup,
  type SanityDocumentBase,
  type Transaction,
} from '../store'
import {applyMutations} from '../store/datasets/applyMutations'
import {commit} from '../store/datasets/commit'
import {squashDMPStrings} from '../store/optimizations/squashDMPStrings'
import {squashMutationGroups} from '../store/optimizations/squashMutations'
import {rebase} from '../store/rebase'
import {toTransactions} from '../store/toTransactions'
import {createSharedListener, type SharedListenerEvents} from './listener'

export interface DocumentMutatorMachineInput {
  id: string
  client: SanityClient
  /** A shared listener can be provided, if not it'll be created using `client.listen()` */
  sharedListener?: ReturnType<typeof createSharedListener>
  /* Preferrably a LRU cache map that is compatible with an ES6 Map, and have documents that allow unique ids to a particular dataset */
  cache?: Map<string, SanityDocument<DocumentType> | null>
}

export type DocumentMutatorMachineParentEvent =
  | {type: 'sync'; id: string; document: SanityDocumentBase}
  | {
      type: 'mutation'
      id: string
      effects: {apply: RawPatch}
      previousRev: string
      resultRev: string
    }
  | {type: 'rebased.local'; id: string; document: SanityDocumentBase}
  | {type: 'rebased.remote'; id: string; document: SanityDocumentBase}
  | {type: 'pristine'; id: string}

export const documentMutatorMachine = setup({
  types: {} as {
    children: {
      getDocument: 'fetch remote snapshot'
      submitTransactions: 'submit mutations as transactions'
    }
    tags: 'busy' | 'error' | 'ready'
    context: {
      client: SanityClient
      /** A shared listener can be provided, if not it'll be created using `client.listen()` */
      sharedListener?: ReturnType<typeof createSharedListener>
      /** The document id */
      id: string
      /* Preferrably a LRU cache map that is compatible with an ES6 Map, and have documents that allow unique ids to a particular dataset */
      cache?: Map<string, SanityDocument<DocumentType> | null>
      /* The remote snapshot of what the document looks like in Content Lake, kept in sync by applying Mendoza patches in real time. undefined means it's unknown if it exists yet, null means its known that it doesn't exist. */
      remote: SanityDocument<DocumentType> | null | undefined
      /* Local snapshot, that is rebased to the remote snapshot whenever that snapshot changes, and allows optimistic local mutations. undefined means it's unknown if the document exists in content lake yet, if both `remote` and `local` is `null` it means it's known that it doesn't exist. If `remote` is defined, and `local` is `null` it means it's optimistically deleted. If `remote` is `null` and `local` defined then it's optimistically created. */
      local: SanityDocument<DocumentType> | null | undefined
      /* Remote mendoza mutation events, needs a better name to differentiate from optimistic mutations */
      mutationEvents: MutationEvent[]
      /* Track staged mutations that can be submitted */
      stagedChanges: MutationGroup[]
      /* Queue mutations mutations that should be staged after an ongoing submission settles */
      stashedChanges: MutationGroup[]
      /* Any kind of error object that the UI can parse and decide how to display/report */
      error: unknown
      /* Used for automatic retrying of loading the remote snapshot */
      fetchRemoteSnapshotAttempts: number
      /* Used for automatic retrying of submitting mutations to Content Lake as a transaction */
      submitTransactionsAttempts: number
    }
    events:
      | SharedListenerEvents
      | {type: 'error'}
      | {type: 'retry'}
      | {type: 'connect'}
      | {type: 'reconnect'}
      | {type: 'welcome'}
      | {type: 'mutate'; mutations: Mutation[]}
      | {type: 'submit'}
      | {
          type: 'xstate.done.actor.getDocument'
          output: SanityDocument<DocumentType>
        }
      | {
          type: 'xstate.done.actor.submitTransactions'
          output: undefined
        }
    input: DocumentMutatorMachineInput
  },
  actions: {
    'assign error to context': assign({error: ({event}) => event}),
    'clear error from context': assign({error: undefined}),
    'connect to server-sent events': raise({type: 'connect'}),
    'listen to server-sent events': spawnChild('server-sent events', {
      id: 'listener',
      input: ({context}) => ({
        listener:
          context.sharedListener || createSharedListener(context.client),
        id: context.id,
      }),
    }),
    'stop listening to server-sent events': stopChild('listener'),
    'buffer remote mutation events': assign({
      mutationEvents: ({event, context}) => {
        assertEvent(event, 'mutation')
        return [...context.mutationEvents, event]
      },
    }),
    'restore stashed changes': assign({
      stagedChanges: ({event, context}) => {
        assertEvent(event, 'xstate.done.actor.submitTransactions')
        return context.stashedChanges
      },
      stashedChanges: [],
    }),
    'rebase fetched remote snapshot': enqueueActions(({enqueue}) => {
      enqueue.assign(({event, context}) => {
        assertEvent(event, 'xstate.done.actor.getDocument')
        const previousRemote = context.remote
        let nextRemote = event.output

        /**
         * We assume all patches that happen while we're waiting for the document to resolve are already applied.
         * But if we do see a patch that has the same revision as the document we just fetched, we should apply any patches following it
         */
        let seenCurrentRev = false
        for (const patch of context.mutationEvents) {
          if (
            !patch.effects?.apply ||
            (!patch.previousRev && patch.transition !== 'appear')
          )
            continue
          if (!seenCurrentRev && patch.previousRev === nextRemote?._rev) {
            seenCurrentRev = true
          }
          if (seenCurrentRev) {
            nextRemote = applyMendozaPatch(
              nextRemote,
              patch.effects.apply,
              patch.resultRev,
            )
          }
        }

        if (
          context.cache &&
          // If the shared cache don't have the document already we can just set it
          (!context.cache.has(context.id) ||
            // But when it's in the cache, make sure it's necessary to update it
            context.cache.get(context.id)!._rev !== nextRemote?._rev)
        ) {
          context.cache.set(context.id, nextRemote as unknown as any)
        }

        const [stagedChanges, local] = rebase(
          context.id,
          // It's annoying to convert between null and undefined, reach consensus
          previousRemote === null ? undefined : previousRemote,
          nextRemote === null ? undefined : (nextRemote as unknown as any),
          context.stagedChanges,
        )

        return {
          remote: nextRemote as unknown as any,
          local: local as unknown as any,
          stagedChanges,
          // Since the snapshot handler applies all the patches they are no longer needed, allow GC
          mutationEvents: [],
        }
      })
      enqueue.sendParent(
        ({context}) =>
          ({
            type: 'rebased.remote',
            id: context.id,
            document: context.remote!,
          }) satisfies DocumentMutatorMachineParentEvent,
      )
    }),
    'apply mendoza patch': assign(({event, context}) => {
      assertEvent(event, 'mutation')
      const previousRemote = context.remote
      // We have already seen this mutation
      if (event.transactionId === previousRemote?._rev) {
        return {}
      }

      const nextRemote = applyMendozaPatch(
        previousRemote!,
        event.effects!.apply,
        event.resultRev,
      )

      if (
        context.cache &&
        // If the shared cache don't have the document already we can just set it
        (!context.cache.has(context.id) ||
          // But when it's in the cache, make sure it's necessary to update it
          context.cache.get(context.id)!._rev !== nextRemote?._rev)
      ) {
        context.cache.set(context.id, nextRemote as unknown as any)
      }

      const [stagedChanges, local] = rebase(
        context.id,
        // It's annoying to convert between null and undefined, reach consensus
        previousRemote === null ? undefined : previousRemote,
        nextRemote === null ? undefined : (nextRemote as unknown as any),
        context.stagedChanges,
      )

      return {
        remote: nextRemote as unknown as any,
        local: local as unknown as any,
        stagedChanges,
      }
    }),
    'increment fetch attempts': assign({
      fetchRemoteSnapshotAttempts: ({context}) =>
        context.fetchRemoteSnapshotAttempts + 1,
    }),
    'reset fetch attempts': assign({
      fetchRemoteSnapshotAttempts: 0,
    }),
    'increment submit attempts': assign({
      submitTransactionsAttempts: ({context}) =>
        context.submitTransactionsAttempts + 1,
    }),
    'reset submit attempts': assign({
      submitTransactionsAttempts: 0,
    }),
    'stage mutation': assign({
      stagedChanges: ({event, context}) => {
        assertEvent(event, 'mutate')
        return [
          ...context.stagedChanges,
          {transaction: false, mutations: event.mutations},
        ]
      },
    }),
    'stash mutation': assign({
      stashedChanges: ({event, context}) => {
        assertEvent(event, 'mutate')
        return [
          ...context.stashedChanges,
          {transaction: false, mutations: event.mutations},
        ]
      },
    }),
    'rebase local snapshot': enqueueActions(({enqueue}) => {
      enqueue.assign({
        local: ({event, context}) => {
          assertEvent(event, 'mutate')
          // @TODO would be helpful to not have to convert back and forth between maps
          const localDataset = new Map()
          if (context.local) {
            localDataset.set(context.id, context.local)
          }
          // Apply mutations to local dataset (note: this is immutable, and doesn't change the dataset)
          const results = applyMutations(event.mutations, localDataset)
          // Write the updated results back to the "local" dataset
          commit(results, localDataset)
          // Read the result from the local dataset again
          return localDataset.get(context.id)
        },
      })
      enqueue.sendParent(
        ({context}) =>
          ({
            type: 'rebased.local',
            id: context.id,
            document: context.local!,
          }) satisfies DocumentMutatorMachineParentEvent,
      )
    }),
    'send pristine event to parent': sendParent(
      ({context}) =>
        ({
          type: 'pristine',
          id: context.id,
        }) satisfies DocumentMutatorMachineParentEvent,
    ),
    'send sync event to parent': sendParent(
      ({context}) =>
        ({
          type: 'sync',
          id: context.id,
          document: context.remote!,
        }) satisfies DocumentMutatorMachineParentEvent,
    ),
    'send mutation event to parent': sendParent(({context, event}) => {
      assertEvent(event, 'mutation')
      return {
        type: 'mutation',
        id: context.id,
        previousRev: event.previousRev!,
        resultRev: event.resultRev!,
        effects: event.effects!,
      } satisfies DocumentMutatorMachineParentEvent
    }),
  },
  actors: {
    'server-sent events': fromEventObservable(
      ({
        input,
      }: {
        input: {listener: ReturnType<typeof createSharedListener>; id: string}
      }) => {
        const {listener, id} = input
        return defer(() => listener).pipe(
          filter(
            event =>
              event.type === 'welcome' ||
              event.type === 'reconnect' ||
              (event.type === 'mutation' && event.documentId === id),
          ),
          // This is necessary to avoid sync emitted events from `shareReplay` from happening before the actor is ready to receive them
          observeOn(asapScheduler),
        )
      },
    ),
    'fetch remote snapshot': fromPromise(
      async ({
        input,
        signal,
      }: {
        input: {client: SanityClient; id: string}
        signal: AbortSignal
      }) => {
        const {client, id} = input
        const document = await client
          .getDocument(id, {
            signal,
          })
          .catch(e => {
            if (e instanceof Error && e.name === 'AbortError') return
            throw e
          })

        return document
      },
    ),
    'submit mutations as transactions': fromPromise(
      async ({
        input,
        signal,
      }: {
        input: {client: SanityClient; transactions: Transaction[]}
        signal: AbortSignal
      }) => {
        const {client, transactions} = input
        for (const transaction of transactions) {
          if (signal.aborted) return
          await client
            .dataRequest('mutate', encodeTransaction(transaction), {
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
    ),
  },
  delays: {
    // Exponential backoff delay function
    fetchRemoteSnapshotTimeout: ({context}) =>
      Math.pow(2, context.fetchRemoteSnapshotAttempts) * 1000,
    submitTransactionsTimeout: ({context}) =>
      Math.pow(2, context.submitTransactionsAttempts) * 1000,
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QQPYGMCuBbMA7ALgLRYb4CG+KATgMQnn5gDaADALqKgAOKsAlvj4pcnEAA9EADhYAWAHQA2GSwUBmAKwBOaQEZJkhQBoQAT0Q6ATAF8rx1JhwFipCtTkQ+sNMNxg0jCBpvXF9-Vg4kEB5+QWFRCQQLFhY5PQB2dRU1SQsdGSVjMwRlHTkWNM00nR1VKryKmzt0bDwielcqOWDQwVwoGgB3MAAbbxxw0WiBIRFIhPUKuQ1NVU0tTU0WFdVCxAt1dTlNhX2WdRltGUk061sQexandspO7r9e-qo-H3eJyKnYrNQPNJJollpVutNttdghVCo5MoTgoMpo8jIkqpGvdmo42i4Xl0fv4+H0aGAqFRqH9uLxpnE5ogFrCLFd5CtNBYFJkdOpuaosXcHnjnAw3G9-AAxMh8YYYL5BYn4GlROmA+KIFEs1R6ORpZYWHIXGR6bHC1qijpyL4Sj6DEZjZjsSZqmYaxK1ORcvlc-ZqSoyNKwnRpGTyK4WDK5BQ6BQ5BRm3EW55uG1K0n9ClUqgqgFuxketJe7nIv2rUNB0x7LmSL2qGMsSySevcmSJhzJgnipWQOgEma510M4HmcqHZYyWqaOMqTQyWGh0osVSGiwC5uGyftx74sWvHuBNMhX7O-5DoHiPae72lvnlwPBydFlRVS7qPIl7cilP74-+SByMMKBkB4ZKoL4cikgAbigADWYByDA+AACJJgQg4xPmI7FHkZQrKGsjqKcCiaMG9YpJOxySBiCiyPoX6dnuRJ-gEgHAaBmaUm4XDDBQABm1BYIhYAoWhyqnrSmHDpeCAKCicjUbU6g6nkFichYsJrLWVxaPsk7KdICZCmJlqEraAFASBvbPAOEmqlJF4JJURbVDcy4Yvk1GVkUsabApMjKZGqjNg2kgMU8Xa-j0FnsQBXBUJ4vRgH2DBOhEkn0o5TLKV6y6WDG6lhkYVYIDoKzyBkeR8pUDZqOFu5WuZEBsVZzUeFQ+AmDQsAYAARlgAgYZl7o6I2tYLJINSSO+3JaMGlQpGkhFhryo2jW2xkdhFTFNS1EAAT1-UCHa4EIdBcEIYdA34AAKlQZC4LAZAksIsBDeqBbrdpym8iuByxlcLK5BYqQLBUZyTcFvL1aZ3YsTFrVyFdx0ZuSXGdDx-GCUjfXXXdD1PS9j3vVhMnrWCFRxtNaRLdcfIsiwuS5fkgZaOUlhpDDP7MdFzWWftzXI-gdrPGlLoOSNyiHFstRySisjcgzahyFoUYBbRsac5tO6w1F7wIwLONHfg0qyvKyVfPgVAmCT0kJGt41pJD02xgcpElUkcZ6rI+q5JcckbU0W0NWZB57QduMCKbcoKmIsCpXIZB8YwVAABRC-jj3PYCsA3XwOAoKQACUNDmttjVh-zEfG9H5u21lpVjSrTtTTNbsstUYJJAFWgA37XORTz+t8+xtcKpb1v1+6KJFopGQqRi6nBlstYcqNK5riusYDztlejzKMfJXHCdJynqd8SJaAABYAEpgFgKCMAAyrgZBcLAV+P3nBfF6XJnc7tfmY8xZnglgWGe-klILzUhYDSJVRpnCONNOcWxWRKBRDYO4uAUD7XgJEMuIdqDi2GgWQgOhgxMyRKyFc8IuQkXUDvK0HgvAHmIR9bCD4SoeSWCoLkoZpxrmXIw0OLEMxsNJgkSc418KhnrHyG4oZYTcPhMifhJx4SCiDjrABSpgHiLtogAUhwW77DRIGXkk55wexKCrJQsg1jBTnPsYRqZviiL6PohuORgyhhBhGKMsZYzxhcXrf8EBPHulUJOPCtRlABWIu7IoORVBIIhMpNYGJyghKHmEvaYjQEkOwhkxQrJtBES0JDOBPlkgKD1JYZSjZORyTXNkwBsVwkFPYTJVYS58JxPKbOYM0gUj7FjGcEMOpciaJxMHXWOTWJV2avFRKpIwARILJRGJBF4mZBIkDE0KtIxLSSDkDYGhWl70Ru1Tq6zsLURBkoLyWRmz8PmlUZmcY1zXDKdMghcy2mIyFh8W5ZN4RFmOFyKaZwiLeT2GVJcy5pBrguCiMK2tvyDwBYbIWejOkSMQBkeQORJq0RNCUDIDNondxuGpPQmRqIXPhiPECuKMpdMkbILZ-SEnLxyjqOJMZsj1jRTYIAA */

  id: 'document-mutator',

  context: ({input}) => ({
    client: input.client.withConfig({allowReconfigure: false}),
    sharedListener: input.sharedListener,
    id: input.id,
    remote: undefined,
    local: undefined,
    mutationEvents: [],
    stagedChanges: [],
    stashedChanges: [],
    error: undefined,
    fetchRemoteSnapshotAttempts: 0,
    submitTransactionsAttempts: 0,
    cache: input.cache,
  }),

  // Auto start the connection by default
  entry: ['connect to server-sent events'],

  on: {
    mutate: {
      actions: ['rebase local snapshot', 'stage mutation'],
    },
  },
  initial: 'disconnected',
  states: {
    disconnected: {
      on: {
        connect: {
          target: 'connecting',
          actions: ['listen to server-sent events'],
        },
      },
    },
    connecting: {
      on: {
        welcome: 'connected',
        reconnect: 'reconnecting',
        error: 'connectFailure',
      },
      tags: ['busy'],
    },
    connectFailure: {
      on: {
        connect: {
          target: 'connecting',
          actions: ['listen to server-sent events'],
        },
      },
      entry: [
        'stop listening to server-sent events',
        'assign error to context',
      ],
      exit: ['clear error from context'],
      tags: ['error'],
    },
    reconnecting: {
      on: {
        welcome: {
          target: 'connected',
        },
        error: {
          target: 'connectFailure',
        },
      },
      tags: ['busy', 'error'],
    },
    connected: {
      on: {
        mutation: {
          actions: ['buffer remote mutation events'],
        },
        reconnect: 'reconnecting',
      },
      entry: ['clear error from context'],
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'fetch remote snapshot',
            id: 'getDocument',
            input: ({context}) => ({
              client: context.client,
              id: context.id,
            }),
            onError: {
              target: 'loadFailure',
            },
            onDone: {
              target: 'loaded',
              actions: [
                'rebase fetched remote snapshot',
                'reset fetch attempts',
              ],
            },
          },

          tags: ['busy'],
        },

        loaded: {
          entry: ['send sync event to parent'],
          on: {
            mutation: {
              actions: ['apply mendoza patch', 'send mutation event to parent'],
            },
          },
          initial: 'pristine',

          states: {
            pristine: {
              on: {
                mutate: {
                  actions: ['rebase local snapshot', 'stage mutation'],
                  target: 'dirty',
                },
              },
              tags: ['ready'],
            },
            dirty: {
              on: {
                submit: 'submitting',
              },
              tags: ['ready'],
            },
            submitting: {
              on: {
                mutate: {
                  actions: ['rebase local snapshot', 'stash mutation'],
                },
              },
              invoke: {
                src: 'submit mutations as transactions',
                id: 'submitTransactions',
                input: ({context}) => {
                  // @TODO perhaps separate utils to be lower level and operate on single documents at a time instead of expecting a local dataset
                  const remoteDataset = new Map()
                  remoteDataset.set(context.id, context.remote)
                  return {
                    client: context.client,
                    transactions: toTransactions(
                      // Squashing DMP strings is the last thing we do before submitting
                      squashDMPStrings(
                        remoteDataset,
                        squashMutationGroups(context.stagedChanges),
                      ),
                    ),
                  }
                },
                onError: {
                  target: 'submitFailure',
                },

                onDone: {
                  target: 'pristine',
                  actions: [
                    'restore stashed changes',
                    'reset submit attempts',
                    'send pristine event to parent',
                  ],
                },
              },
              /**
               * 'busy' means we should show a spinner, 'ready' means we can still accept mutations, they'll be applied optimistically right away, and queued for submissions after the current submission settles
               */
              tags: ['busy', 'ready'],
            },
            submitFailure: {
              exit: ['clear error from context'],
              after: {
                submitTransactionsTimeout: {
                  actions: ['increment submit attempts'],
                  target: 'submitting',
                },
              },
              on: {
                retry: 'submitting',
              },
              /**
               * How can it be both `ready` and `error`? `ready` means it can receive mutations, optimistically apply them, and queue them for submission. `error` means it failed to submit previously applied mutations.
               * It's completely fine to keep queueing up more mutations and applying them optimistically, while showing UI that notifies that mutations didn't submit, and show a count down until the next automatic retry.
               */
              tags: ['error', 'ready'],
            },
          },
        },

        loadFailure: {
          exit: ['clear error from context'],
          after: {
            fetchRemoteSnapshotTimeout: {
              actions: ['increment fetch attempts'],
              target: 'loading',
            },
          },
          on: {
            retry: 'loading',
          },
          tags: ['error'],
        },
      },
    },
  },
})

function applyMendozaPatch<const DocumentType extends SanityDocumentBase>(
  document: DocumentType | undefined,
  patch: RawPatch,
  nextRevision: string | undefined,
) {
  const next = applyPatch(omitRev(document), patch)
  if (!next) {
    return null
  }
  return Object.assign(next, {_rev: nextRevision})
}

function omitRev<const DocumentType extends SanityDocumentBase>(
  document: DocumentType | undefined,
) {
  if (!document) {
    return null
  }
  // eslint-disable-next-line unused-imports/no-unused-vars
  const {_rev, ...doc} = document
  return doc
}
