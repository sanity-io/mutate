import {
  type MutationEvent,
  type ReconnectEvent,
  type SanityClient,
  type WelcomeEvent,
} from '@sanity/client'
import {type SanityDocumentBase} from '@sanity/mutate'
import {
  asapScheduler,
  defer,
  filter,
  merge,
  type ObservedValueOf,
  observeOn,
  share,
  shareReplay,
  timer,
} from 'rxjs'
import {fromEventObservable, fromPromise} from 'xstate'

/**
 * Creates a single, shared, listener EventSource that strems remote mutations, and notifies when it's online (welcome), offline (reconnect).
 */
export function createSharedListener(client: SanityClient) {
  const allEvents$ = client
    .listen(
      '*[!(_id in path("_.**"))]',
      {},
      {
        events: [
          'welcome',
          'mutation',
          'reconnect',
          // @ts-expect-error - @TODO add this to the client typings
          'error',
          // @ts-expect-error - @TODO add this to the client typings
          'channelError',
        ],
        includeResult: false,
        includePreviousRevision: false,
        visibility: 'transaction',
        effectFormat: 'mendoza',
        includeMutations: false,
      },
    )
    .pipe(share({resetOnRefCountZero: true}))

  // Reconnect events emitted in case the connection is lost
  const reconnect = allEvents$.pipe(
    filter((event): event is ReconnectEvent => event.type === 'reconnect'),
  )

  // Welcome events are emitted when the listener is (re)connected
  const welcome = allEvents$.pipe(
    filter((event): event is WelcomeEvent => event.type === 'welcome'),
  )

  // Mutation events coming from the listener
  const mutations = allEvents$.pipe(
    filter((event): event is MutationEvent => event.type === 'mutation'),
  )

  // Replay the latest connection event that was emitted either when the connection was disconnected ('reconnect'), established or re-established ('welcome')
  const connectionEvent = merge(welcome, reconnect).pipe(
    shareReplay({bufferSize: 1, refCount: true}),
  )

  // Emit the welcome event if the latest connection event was the 'welcome' event.
  // Downstream subscribers will typically map the welcome event to an initial fetch
  const replayWelcome = connectionEvent.pipe(
    filter(latestConnectionEvent => latestConnectionEvent.type === 'welcome'),
  )

  // Combine into a single stream
  return merge(replayWelcome, mutations, reconnect)
}

/**
 * Wraps a shared listener in a new observer that have a delayed unsubscribe, allowing the shared listener to
 * stay active and connected, useful when it's expected that transitions between observers are frequent and agressive setup and teardown of EventSource is expensive or inefficient.
 */
export function sharedListenerWithKeepAlive(
  sharedListener: ReturnType<typeof createSharedListener>,
  keepAlive: number = 1_000,
) {
  return defer(() => sharedListener).pipe(
    share({resetOnRefCountZero: () => timer(keepAlive, asapScheduler)}),
  )
}

/** Creates a machine that taps into a shared observable with a delayed unsubscribe */
export function defineRemoteEvents({
  listener,
  keepAlive,
}: {
  listener: ReturnType<typeof createSharedListener>
  keepAlive: number
}) {
  // @TODO verify that it can recover from being offline for a long time and come back online
  return fromEventObservable(({input}: {input: {documentId: string}}) =>
    sharedListenerWithKeepAlive(listener, keepAlive).pipe(
      filter(
        event =>
          event.type === 'welcome' ||
          event.type === 'reconnect' ||
          (event.type === 'mutation' && event.documentId === input.documentId),
      ),
      // This is necessary to avoid sync emitted events from `shareReplay` from happening before the actor is ready to receive them
      observeOn(asapScheduler),
    ),
  )
}
export type RemoteEventsMachine = ReturnType<typeof defineRemoteEvents>

/** Creates a machine that is responsible for fetching documents to be kept in sync with mendoza patches */
export function defineGetDocument<
  const DocumentType extends SanityDocumentBase = SanityDocumentBase,
>({client}: {client: SanityClient}) {
  return fromPromise(
    async ({
      input,
      signal,
    }: {
      input: {documentId: string}
      signal: AbortSignal
    }) => {
      const document = await client
        .getDocument<DocumentType>(input.documentId, {
          signal,
        })
        .catch(e => {
          if (e instanceof Error && e.name === 'AbortError') return
          throw e
        })

      return document
    },
  )
}
export type GetDocumentMachine<
  DocumentType extends SanityDocumentBase = SanityDocumentBase,
> = ReturnType<typeof defineGetDocument<DocumentType>>

export type RemoteSnapshotEvents = ObservedValueOf<
  ReturnType<typeof createSharedListener>
>
