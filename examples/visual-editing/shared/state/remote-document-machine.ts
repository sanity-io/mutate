/* eslint-disable no-console */
import {type MutationEvent, type SanityDocument} from '@sanity/client'
import {type SanityDocumentBase} from '@sanity/mutate'
import {applyPatch, type RawPatch} from 'mendoza'
import {assign, setup} from 'xstate'

import {
  type GetDocumentMachine,
  type RemoteEventsMachine,
  type RemoteSnapshotEvents,
} from './remote-events-machine'

/**
 * This machine is responsible for keeping a snapshot of a document in sync with any remote changes.
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
export function defineRemoteDocumentMachine<
  const DocumentType extends SanityDocumentBase = SanityDocumentBase,
>({
  getDocument,
  remoteEvents,
}: {
  getDocument: GetDocumentMachine<DocumentType>
  remoteEvents: RemoteEventsMachine
}) {
  return setup({
    types: {} as {
      children: {
        remoteEvents: 'remoteEvents'
        getDocument: 'getDocument'
      }
      context: {
        documentId: string
        snapshot: SanityDocument<DocumentType> | null
        mutationEvents: MutationEvent[]
        error: unknown
        attempts: number
      }
      events: RemoteSnapshotEvents | {type: 'retry'}
      input: {
        documentId: string
      }
    },
    actors: {
      getDocument,
      remoteEvents,
    },
    delays: {
      // Exponential backoff delay function
      timeout: ({context}) => Math.pow(2, context.attempts) * 1000,
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QCcwFsD2AXMARDAxgK5pgB2WAxKgRmWWAVgNoAMAuoqAA4awCWWfnS4gAHogAsAJgA0IAJ6IAjAA4A7ADoAnLt3T1kgKxHtANiMBmAL7X5qTDnzFSFTfwgAbMJQDuYT1pSNk4kEF4BIREwiQRLA01WVVNldVTLVWldM3klBGVpVU0jVlLWSWVJdXLWbVt7dGw8QhJyLE1PDABDCH4yKEoIOjB3MgA3DABrEZgsZ1aKENEIwWEyUVjkosttZOVWSwsNHMVESwrEgoNleJ2k1TN6kAcm+dd2zp6+gbBkZAxkJpuJ4ulgAGYAtCaWZvNpLMIrKLrGJnBJJFJpdQZLLmXKIaSWLSSPTmSQHHYVJ4vJwtd4dbq9fqUNBELCgtbwnh8VbRUCxMwyTQE1hGaSsZRmK5mbR4hAE7SJSxGNKWVL7GSqGx2Z6NGkuNr0r5Mmh0BhMTnhblIjaIMyEzRpWradSinapWWVSTFTJGMzSZRqaQGB5U3XNfVuE30RhCJn+QIYYIcZZWtY2uJo5LaNVYzLZD0PHR6VSa5XqdQWUOOcMLdpgrr8TxEVB+AJBMAWxFplEZrTo7OY7H504ZoraKy1ZJkmR+quvWkG+uN5s+VBYZAKTup3niVF9rM5oe4keEhXGVWsI5mcqEud62uaWBEAgEOCwZms9l0LeRbt8lTlAq4rmJeFZmBY8SytIZhaOoyRmJqaTSuo2hKneNZ0k+L5vtQjCmjGP48si-75OUXolKUqgVFk5yWJYHppJodHSBRIqHDIGS2NqZAYBAcCiNSGFtCmv47rEAC0Jx5JJ6Gwm4HjeCJRHpgSRRGFml4IeYqisOoHpZIkZQGLsyjaEGqiyQubifIyUBKdaPZGJIZiaHsvqkjclhJLKdFFJIJaqBKJhktokiWRG7RRmasZ2Qi27Ebu+QVq5hT7BooUsVUekjmoRLFqW5YVk54UPkuTaoPZf6JUG0iaAKIrJGKeaoZIPnQToE67E55TQdIJWYc+r6wPAcWiQlsT7FYTGhaYzk6UkkEntKQoZIFzqTaKYVcUAA */
    id: 'remoteDocument',
    context: ({input}) => ({
      documentId: input.documentId,
      snapshot: null,
      mutationEvents: [] as MutationEvent[],
      error: undefined,
      attempts: 0,
    }),

    invoke: {
      src: 'remoteEvents',
      id: 'remoteEvents',
      input: ({context}) => ({documentId: context.documentId}),
    },

    on: {
      // If a reconnect event happens, then we should go to a `reconnecting` state that guarantees that we don't attempt retrying fetching the doc until after the EventSource is established and other scenarios
      reconnect: '.reconnecting',
    },

    states: {
      idle: {
        on: {
          welcome: 'loading',
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
          reconnect: {
            actions: assign({mutationEvents: []}),
          },
        },
        invoke: {
          src: 'getDocument',
          id: 'getDocument',
          input: ({context}) => ({documentId: context.documentId}),

          onDone: {
            target: 'success',
            actions: assign({
              // @ts-expect-error @TODO figure out this later and when to use SanityDocument<Shape>, SanityDocumentBase and all this nonsense
              snapshot: ({event, context}) => {
                let document = event.output

                /**
                 * We assume all patches that happen while we're waiting for the document to resolve are already applied.
                 * But if we do see a patch that has the same revision as the document we just fetched, we should apply any patches following it
                 */
                let seenCurrentRev = false
                for (const patch of context.mutationEvents) {
                  if (!patch.effects?.apply || !patch.previousRev) continue
                  if (!seenCurrentRev && patch.previousRev === document?._rev) {
                    seenCurrentRev = true
                  }
                  if (seenCurrentRev) {
                    document = applyMendozaPatch(
                      // @ts-expect-error handle later
                      document,
                      patch.effects.apply,
                      patch.resultRev,
                    )
                  }
                }

                return document
              },
              // Since the snapshot handler applies all the patches they are no longer needed, allow GC
              mutationEvents: [],
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

      success: {
        on: {
          // After the document has loaded, apply the mendoza patches directly
          mutation: {
            actions: assign({
              snapshot: ({event, context}) =>
                event.effects?.apply
                  ? applyMendozaPatch(
                      // @ts-expect-error handle later
                      context.snapshot,
                      event.effects.apply,
                      event.resultRev,
                    )
                  : context.snapshot,
            }),
          },
          reconnect: {
            actions: assign({snapshot: null}),
          },
        },
      },
    },

    initial: 'idle',
  })
}

export type RemoteDocumentMachine<
  DocumentType extends SanityDocumentBase = SanityDocumentBase,
> = ReturnType<typeof defineRemoteDocumentMachine<DocumentType>>

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
