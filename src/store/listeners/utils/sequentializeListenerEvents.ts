import {partition as lodashPartition} from 'lodash'
import {concat, type Observable, of, switchMap, throwError, timer} from 'rxjs'
import {mergeMap, scan} from 'rxjs/operators'

import {type SanityDocumentBase} from '../../../mutations/types'
import {type ListenerEvent, type ListenerMutationEvent} from '../../types'
import {DeadlineExceededError, MaxBufferExceededError} from '../errors'
import {discardChainTo, toOrderedChains} from './eventChainUtils'

/**
 * lodash types are not great
 * todo: replace with es-toolkit
 * @param array
 * @param predicate
 */
function partition<T>(
  array: T[],
  predicate: (element: T) => boolean,
): [trueValues: T[], falseValues: T[]] {
  return lodashPartition(array, predicate)
}
export interface ListenerSequenceState {
  /**
   * Tracks the latest revision from the server that can be applied locally
   * Once we receive a mutation event that has a `previousRev` that equals `base.revision`
   * we will move `base.revision` to the event's `resultRev`
   * `base.revision` will be undefined if document doesn't exist.
   * `base` is `undefined` until the snapshot event is received
   */
  base: {revision: string | undefined} | undefined
  /**
   * Array of events to pass on to the stream, e.g. when mutation applies to current head revision, or a chain is complete
   */
  emitEvents: ListenerEvent[]
  /**
   * Buffer to keep track of events that doesn't line up in a [previousRev, resultRev] -- [previousRev, resultRev] sequence
   * This can happen if events arrive out of order, or if an event in the middle for some reason gets lost
   */
  buffer: ListenerMutationEvent[]
}

const DEFAULT_MAX_BUFFER_SIZE = 20
const DEFAULT_DEADLINE_MS = 30000

const EMPTY_ARRAY: never[] = []

export interface SequentializeListenerEventsOptions {
  maxBufferSize?: number
  resolveChainDeadline?: number
  onDiscard?: (discarded: ListenerMutationEvent[]) => void
  onBrokenChain?: (discarded: ListenerMutationEvent[]) => void
}

/**
 * Takes an input observable of listener events that might arrive out of order, and emits them in sequence
 * If we receive mutation events that doesn't line up in [previousRev, resultRev] pairs we'll put them in a buffer and
 * check if we have an unbroken chain every time we receive a new event
 *
 * If the buffer grows beyond `maxBufferSize`, or if `resolveChainDeadline` milliseconds passes before the chain resolves
 * an OutOfSyncError will be thrown on the stream
 *
 * @internal
 */
export function sequentializeListenerEvents<Doc extends SanityDocumentBase>(
  options?: SequentializeListenerEventsOptions,
) {
  const {
    resolveChainDeadline = DEFAULT_DEADLINE_MS,
    maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
    onDiscard,
    onBrokenChain,
  } = options || {}

  return (input$: Observable<ListenerEvent>): Observable<ListenerEvent> => {
    return input$.pipe(
      scan(
        (
          state: ListenerSequenceState,
          event: ListenerEvent,
        ): ListenerSequenceState => {
          if (event.type === 'mutation' && !state.base) {
            throw new Error(
              'Invalid state. Cannot create a sequence without a base',
            )
          }
          if (event.type === 'sync') {
            // When receiving a new snapshot, we can safely discard the current orphaned and chainable buffers
            return {
              base: {revision: event.document?._rev},
              buffer: EMPTY_ARRAY,
              emitEvents: [event],
            }
          }

          if (event.type === 'mutation') {
            if (!event.resultRev && !event.previousRev) {
              throw new Error(
                'Invalid mutation event: Events must have either resultRev or previousRev',
              )
            }
            // Note: the buffer may have multiple holes in it (this is a worst case scenario, and probably not likely, but still),
            // so we need to consider all possible chains
            // `toOrderedChains` will return all detected chains and each of the returned chains will be ordered
            // Once we have a list of chains, we can then discard any chain that leads up to the current revision
            // since they are already applied on the document
            const orderedChains = toOrderedChains(
              state.buffer.concat(event),
            ).map(chain => {
              // in case the chain leads up to the current revision
              const [discarded, rest] = discardChainTo(
                chain,
                state.base!.revision,
              )
              if (onDiscard && discarded.length > 0) {
                onDiscard(discarded)
              }
              return rest
            })

            const [applicableChains, _nextBuffer] = partition(
              orderedChains,
              chain => {
                // note: there can be at most one applicable chain
                return state.base!.revision === chain[0]?.previousRev
              },
            )

            const nextBuffer = _nextBuffer.flat()
            if (applicableChains.length > 1) {
              throw new Error('Expected at most one applicable chain')
            }
            if (
              applicableChains.length > 0 &&
              applicableChains[0]!.length > 0
            ) {
              // we now have a continuous chain that can apply on the base revision
              // Move current base revision to the last mutation event in the applicable chain
              const lastMutation = applicableChains[0]!.at(-1)!
              const nextBaseRevision =
                // special case: if the mutation deletes the document it technically has  no revision, despite
                // resultRev pointing at a transaction id.
                lastMutation.transition === 'disappear'
                  ? undefined
                  : lastMutation?.resultRev
              return {
                base: {revision: nextBaseRevision},
                emitEvents: applicableChains[0]!,
                buffer: nextBuffer,
              }
            }

            if (nextBuffer.length >= maxBufferSize) {
              throw new MaxBufferExceededError(
                `Too many unchainable mutation events: ${state.buffer.length}`,
                state,
              )
            }
            return {
              ...state,
              buffer: nextBuffer,
              emitEvents: EMPTY_ARRAY,
            }
          }
          // Any other event (e.g. 'reconnect' is passed on verbatim)
          return {...state, emitEvents: [event]}
        },
        {
          emitEvents: EMPTY_ARRAY,
          base: undefined,
          buffer: EMPTY_ARRAY,
        },
      ),
      switchMap(state => {
        if (state.buffer.length > 0) {
          onBrokenChain?.(state.buffer)
          return concat(
            of(state),
            timer(resolveChainDeadline).pipe(
              mergeMap(() =>
                throwError(() => {
                  return new DeadlineExceededError(
                    `Did not resolve chain within a deadline of ${resolveChainDeadline}ms`,
                    state,
                  )
                }),
              ),
            ),
          )
        }
        return of(state)
      }),
      mergeMap(state => {
        // this will simply flatten the list of events into individual emissions
        // if the flushEvents array is empty, nothing will be emitted
        return state.emitEvents
      }),
    )
  }
}
