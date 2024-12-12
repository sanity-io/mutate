/* eslint-disable no-console */
import {type MutationEvent, type SanityDocument} from '@sanity/client'
import {type Mutation, type SanityDocumentBase} from '@sanity/mutate'
import {
  applyMutations,
  commit,
  type MutationGroup,
  rebase,
  squashDMPStrings,
  squashMutationGroups,
  toTransactions,
} from '@sanity/mutate/_unstable_machine'
import {applyPatch, type RawPatch} from 'mendoza'
import {assertEvent, assign, setup} from 'xstate'

import {
  type GetDocumentMachine,
  type RemoteEventsMachine,
  type RemoteSnapshotEvents,
} from './remote-events-machine'
import {type SubmitTransactionsMachine} from './submit-transactions-machine'

/**
 * This machine is responsible for keeping a snapshot of a document in sync with any remote changes, as well as applying optimistic mutations, reconciling local and remote updates, and optimizing mutations before sending them in a transaction.
 * It will setup a long lived subscription to a `client.listen()` instance.
 * It's recommended that the `remoteEvents` machine is using a RxJS observer that can ensure that a single EventSource
 * is established and its events multicast to all listeners, instead of setting up multiple EventSources to the same dataset as that would be a waste of resources and network bandwidth,
 * not to mention there's a technical limit to how many concurrent `client.listen()` instances that a dataset allows: https://www.sanity.io/docs/technical-limits#c973bb88d2be
 * The connection is built on mendoza events which are efficient and low bandwidth.
 * If a document doesn't exist yet, the `getDocument` actor won't return a result,
 * but once a document is created it'll emit a mendoza event that will create the document without needing to refetch it.
 * If the `getDocument` fetch itself fails, then it has automatic retries with exponential backoff, as well as the ability to manually fire a `retry` event.
 *
 * All in all there's a lot of edge cases and logic to consider when one wishes to have a snapshot of a remote document that is then kept in sync with remote changes.
 * This machine handles all of those concerns, so that other machines only have to care about wether we have a snapshot of the remote or not, and to handle that accordingly.
 */
export function defineDocumentEditorMachine<
  const DocumentType extends SanityDocumentBase = SanityDocumentBase,
>({
  getDocument,
  remoteEvents,
  submitTransaction,
}: {
  getDocument: GetDocumentMachine<DocumentType>
  remoteEvents: RemoteEventsMachine
  submitTransaction: SubmitTransactionsMachine
}) {
  return setup({
    types: {} as {
      children: {
        remoteEvents: 'remoteEvents'
        getDocument: 'getDocument'
        submitTransaction: 'submitTransaction'
      }
      context: {
        /* The document id, matches `_id` on the document if it exists, and is immutable. If a different document should be edited, then another machine should be spawned for that document */
        documentId: string
        /* Preferrably a LRU cache map that is compatible with an ES6 Map, and have documents that allow unique ids to a particular dataset */
        cache: Map<string, SanityDocument<DocumentType> | null>
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
        error: unknown
        attempts: number
      }
      events:
        | RemoteSnapshotEvents
        | {type: 'retry'}
        | {type: 'submit'}
        | {type: 'mutate'; mutations: Mutation[]}
        | {type: 'success'}
        // Rebases the local snapshot with the remote snapshot
        | {type: 'rebase local to remote'}
        // Build up list over changes, mutations and transactions we wish to submit later
        | {type: 'stage changes'}
        // Applies the event changes to the local document snapshot
        | {type: 'optimistically mutate'}
        | {type: 'stash changes'}
        | {type: 'restore stashed changes'}
      input: {
        documentId: string
        cache?: Map<string, SanityDocument<DocumentType> | null>
      }
    },
    actors: {
      getDocument,
      remoteEvents,
      submitTransaction,
    },
    actions: {
      'stage changes': assign({
        stagedChanges: ({context, event}) => {
          assertEvent(event, 'mutate')
          const {mutations} = event

          return [...context.stagedChanges, {transaction: false, mutations}]
        },
      }),
      'optimistically mutate': assign({
        local: ({context, event}) => {
          assertEvent(event, 'mutate')
          const {mutations} = event

          // @TODO perhaps separate utils to be lower level and operate on single documents at a time instead of expecting a local dataset
          const localDataset = new Map()
          localDataset.set(context.documentId, context.local)
          // Apply mutations to local dataset (note: this is immutable, and doesn't change the dataset)
          const results = applyMutations(mutations, localDataset)
          // Write the updated results back to the "local" dataset
          commit(results, localDataset)
          return localDataset.get(context.documentId) || null
        },
      }),
      'stash changes': assign({
        stashedChanges: ({context, event}) => {
          assertEvent(event, 'mutate')
          const {mutations} = event

          return [...context.stashedChanges, {transaction: false, mutations}]
        },
      }),
      'restore changes': assign({
        stagedChanges: ({context}) => {
          return context.stashedChanges
        },
        stashedChanges: [],
      }),
    },
    delays: {
      // Exponential backoff delay function
      timeout: ({context}) => Math.pow(2, context.attempts) * 1000,
    },
    guards: {
      isCached: ({context}) => {
        return context.cache.has(context.documentId)
      },
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QQPYGMCuBbMA7ALgLSQCW+KATgMQVhoq6534DaADALqKgAOKsZEg24gAHogAsAJgA0IAJ6IAjADYArADoAnAGZVEiTolqpOgBxszAXytzUmHAWIQylDSQgAbMFQDuYT3ocdi4kED4BfCFcEXEEKSkzDTYjFKU2NTYtMzNTOUUEFSkVDSUAdh0dKSULMyLjGzt0bDwiUnIKdy8ff0CUYKVQ3n5BYTC46Q1qqS0JFS0tYp0ylPzETM0tFUs1JRMdLK0MxpB7Fqd2t08UAEMXXCgqVCZ3XAA3FABrMA0YfAARZqOVicEQRUYxcaIMwSJSlKQSbISMqw6pZNbxBYaZYWMozVQqQkqMonM7A5yuTrXO4kB5UMAUChuHieG74ABmlCwvzAAKBrRCYJGUTGoDiVSkGjKZl2KiUiKkajUyIxCKSC22ZRqc3UyNJ-IuLg6Gmp90eWAw+DZ0UFYXBIshYsQeIk2LYczxCKUaK0GKUWw06j26VhRMJJNspwNbSNblo9EYzFpj16QTAtuGkWisXWOi0GjMKyk7syZTUBwkfvU2j0KgMRn2tX1DlaFON7JuJE8GFoNF5FHkGfCwuzUIQexKxj0WRR3vSswxejhiSqbBUMMba+b5xjlI0Ha7PZ8olgVvwPxu7PPFAAFFEcChLQBKJ7RttuA-d2hD+2jp3xTQLA9bIVm2ZUlUXHRNAkDIVCghYpAqMwtDUbdyUuKlbggSAqAtM8bVBO0R1FMRlDqOE2BWKDcjKODiVkBRlESDRdgWNj2IWaxIzJVsMJNLDIA0HgKBIU9aR8PC2XTQjMwhHNx3KJIjGWFCylonR6IxExXXURJvVQ7i3z401BJcCh8HkKhYAwAAjLAyB-YjHVI8c1HmFjdDKVT1M0xiEDcsoCyVTyDKaFtDT3EyIA0MyLNwy0pMcrMSLiJRlh0bR1y8tQ1LovEMQMNhtERLLQqjcLd2NKKNGsuyyCiOlnh+WkPm+GrbPs-AABUKBuXBYBuNAHSSuSxwnfM1E87y8oYgoZnVCp9LQ3jY0wu5BNqzqGseBkmU6Fk2U5ChuU2sger6gahoIoZh2S5y4mqddkjmRZKJ8sotOrd1tlDMNCWWiKqoE6LTvwbb4rPaSbt-FKyK8gt4LMKp3tmyR-WKrZCzKnjAauYH2rq-AADFOy-CSEvPEaHXk0wYWxSbpDevKCrlAtCSg36wwByq8fWkGOrIEnD17Wh8AHKm-xchItDhPRFWMXKNI+vzdldZUfoJP6bEjXAUGw+AwhxnmKCFO75MIGXtCVCxtiRrVjDMDELZrNQzBqFDVAJJRuffToPG8U3Rv-QhDCt1210sZZ5VdrTy2SBINb+iMwp3X3+JpB5A+psdMldWi5ml-04JVPyYKKmYZZnGW9BRbGjNWjR4wYJgrszoizbHYs4WRFCDloywkaKP0ERYusajYNh-UmyopB9vjPyPLPJYmVH4gkJJDH0QxjFpyw54bqKl9h8dJ5KUwDGLRXfLmpRu8WhEOM4-fIvx4TRIasAj-u5Q11dc-GavvlFWcc2AJ3dJrcMz8gZ8xiiQcyBRZLZ3-PKRCUpii20QjNT6SlgrLDrhVNO1VQbbS-vJcoiwpiZBLIA1eypApQWnmWKBvNsL80JkLMmpDO4wU0GWCeCt3paWQlMPEictbayAA */
    id: 'document-editor',
    context: ({input}) => ({
      documentId: input.documentId,
      // @TODO provide an LRU Cache here that is synced with `dataset-lru-cache-machine`
      cache:
        input.cache || new Map<string, SanityDocument<DocumentType> | null>(),
      remote: undefined,
      local: undefined,
      mutationEvents: [],
      stagedChanges: [],
      stashedChanges: [],
      error: undefined,
      attempts: 0,
    }),

    invoke: {
      src: 'remoteEvents',
      // id: 'remoteEvents',
      input: ({context}) => ({documentId: context.documentId}),
    },

    on: {
      // Reconnect failures are even worse than regular failures
      reconnect: '.reconnecting',
    },

    states: {
      idle: {
        on: {
          welcome: [
            {
              guard: 'isCached',
              target: 'loaded',
              actions: assign({
                remote: ({context}) => context.cache.get(context.documentId),
              }),
            },
            {target: 'loading'},
          ],
        },
      },

      loading: {
        on: {
          // While the document is loading, buffer up mutation events so we can replay them after the document is fetched
          mutation: {
            actions: assign({
              mutationEvents: ({event, context}) => [
                ...context.mutationEvents,
                event,
              ],
              error: undefined,
            }),
          },
        },
        invoke: {
          src: 'getDocument',
          id: 'getDocument',
          input: ({context}) => ({documentId: context.documentId}),

          onDone: {
            target: 'loaded',
            actions: assign(({event, context}) => {
              const previousRemote = context.remote
              let nextRemote = event.output

              /**
               * We assume all patches that happen while we're waiting for the document to resolve are already applied.
               * But if we do see a patch that has the same revision as the document we just fetched, we should apply any patches following it
               */
              let seenCurrentRev = false
              for (const patch of context.mutationEvents) {
                if (!patch.effects?.apply || !patch.previousRev) continue
                if (!seenCurrentRev && patch.previousRev === nextRemote?._rev) {
                  seenCurrentRev = true
                }
                if (seenCurrentRev) {
                  nextRemote = applyMendozaPatch(
                    // @ts-expect-error handle later
                    nextRemote,
                    patch.effects.apply,
                    patch.resultRev,
                  )
                }
              }

              if (
                // If the shared cache don't have the document already we can just set it
                !context.cache.has(context.documentId) ||
                // But when it's in the cache, make sure it's necessary to update it
                context.cache.get(context.documentId)!._rev !== nextRemote?._rev
              ) {
                context.cache.set(
                  context.documentId,
                  nextRemote as unknown as any,
                )
              }

              const [stagedChanges, local] = rebase(
                context.documentId,
                // It's annoying to convert between null and undefined, reach consensus
                previousRemote === null ? undefined : previousRemote,
                nextRemote === null
                  ? undefined
                  : (nextRemote as unknown as any),
                context.stagedChanges,
              )

              return {
                remote: nextRemote as unknown as any,
                local: local as unknown as any,
                stagedChanges,
                // Since the snapshot handler applies all the patches they are no longer needed, allow GC
                mutationEvents: [],
              }
            }),
          },

          onError: {
            target: 'failure',
            actions: assign({
              error: ({event}) => event.error,
              // If the document fetch fails then we can assume any mendoza patches we buffered up will no longer be needed
              mutationEvents: [],
            }),
          },
        },
      },

      reconnecting: {
        on: {
          welcome: 'loading',
        },
        // A reconnection event is considered to be a catastrophic failure, and we have to reset remote state
        // We don't reset local state, such as stagedChanges, the local snapshot, as optimistic mutations are still valid and some edits should be fine to do until we're back online
        entry: [
          assign({
            remote: null,
            mutationEvents: [],
          }),
        ],
      },

      failure: {
        after: {
          timeout: {
            actions: assign({attempts: ({context}) => context.attempts + 1}),
            target: 'loading',
          },
        },
        on: {
          // We can also manually retry
          retry: 'loading',
        },
      },

      loaded: {
        on: {
          // After the document has loaded, apply the mendoza patches directly
          mutation: {
            actions: assign(({context, event}) => {
              const previousRemote = context.remote

              // @TODO read from shared cache and check if it's necessary to apply mendoza
              const nextRemote = event.effects?.apply
                ? applyMendozaPatch(
                    // @ts-expect-error handle later
                    context.remote,
                    event.effects.apply,
                    event.resultRev,
                  )
                : context.remote

              const [stagedChanges, local] = rebase(
                context.documentId,
                // It's annoying to convert between null and undefined, reach consensus
                previousRemote === null ? undefined : previousRemote,
                nextRemote === null
                  ? undefined
                  : (nextRemote as unknown as any),
                context.stagedChanges,
              )

              return {
                remote: nextRemote as unknown as any,
                local: local as unknown as any,
                stagedChanges,
              }
            }),
          },
        },

        initial: 'pristine',
        states: {
          pristine: {
            on: {
              mutate: {
                actions: ['optimistically mutate', 'stage changes'],
                target: 'dirty',
              },
            },
          },
          dirty: {
            on: {
              submit: 'submitting',
              mutate: {
                actions: ['optimistically mutate', 'stage changes'],
              },
            },
          },
          submitting: {
            invoke: {
              src: 'submitTransaction',
              id: 'submitTransaction',
              input: ({context}) => {
                // @TODO perhaps separate utils to be lower level and operate on single documents at a time instead of expecting a local dataset
                const remoteDataset = new Map()
                remoteDataset.set(context.documentId, context.remote)
                return {
                  transactions: toTransactions(
                    // Squashing DMP strings is the last thing we do before submitting
                    squashDMPStrings(
                      remoteDataset,
                      squashMutationGroups(context.stagedChanges),
                    ),
                  ),
                }
              },

              onDone: {
                target: 'pristine',
                actions: ['restore changes'],
              },

              onError: {
                target: 'submitFailure',
                actions: assign({
                  error: ({event}) => event.error,
                  // @TODO handle restoring stuff?
                }),
              },
            },

            on: {
              mutate: {
                actions: ['optimistically mutate', 'stash changes'],
              },
            },
          },
          submitFailure: {
            on: {
              mutate: {
                actions: ['optimistically mutate', 'stash changes'],
              },
              retry: 'submitting',
            },
          },
        },
      },
    },

    initial: 'idle',
  })
}

export type DocumentEditorMachine<
  DocumentType extends SanityDocumentBase = SanityDocumentBase,
> = ReturnType<typeof defineDocumentEditorMachine<DocumentType>>

export function applyMendozaPatch<
  const DocumentType extends SanityDocumentBase,
>(
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
