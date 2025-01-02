import {type SanityClient} from '@sanity/client'
import {sortedIndex} from 'lodash'
import {type Observable, of} from 'rxjs'
import {filter, map, mergeMap, scan} from 'rxjs/operators'

import {type ListenerEndpointEvent, type QueryParams} from '../types'

export type DocumentIdSetState = {
  status: 'connecting' | 'reconnecting' | 'connected'
  event: DocumentIdSetEvent | InitialEvent
  snapshot: string[]
}

export type InitialEvent = {type: 'connect'}

export type InsertMethod = 'sorted' | 'prepend' | 'append'

export type DocumentIdSetEvent =
  | {type: 'sync'; documentIds: string[]}
  | {type: 'reconnect'}
  | {
      type: 'op'
      op: 'add' | 'remove'
      documentId: string
    }

const INITIAL_STATE: DocumentIdSetState = {
  status: 'connecting',
  event: {type: 'connect'},
  snapshot: [],
}

export type FetchDocumentIdsFn = (
  query: string,
  params?: QueryParams,
  options?: {tag?: string},
) => Observable<string[]>

export type IdSetListenFn = (
  query: string,
  params?: QueryParams,
  options?: {
    visibility: 'transaction'
    events: ['welcome', 'mutation', 'reconnect']
    includeResult: false
    includeMutations: false
    tag?: string
  },
) => Observable<ListenerEndpointEvent>

export function createIdSetListener(
  listen: IdSetListenFn,
  fetch: FetchDocumentIdsFn,
) {
  return function listenIdSet(
    queryFilter: string,
    params: QueryParams,
    options: {tag?: string} = {},
  ) {
    const {tag} = options

    const query = `*[${queryFilter}]._id`
    function fetchFilter() {
      return fetch(query, params, {
        tag: tag ? tag + '.fetch' : undefined,
      }).pipe(
        map((result): string[] => {
          if (!Array.isArray(result)) {
            throw new Error(
              `Expected query to return array of documents, but got ${typeof result}`,
            )
          }
          return result as string[]
        }),
      )
    }
    return listen(query, params, {
      visibility: 'transaction',
      events: ['welcome', 'mutation', 'reconnect'],
      includeResult: false,
      includeMutations: false,
      tag: tag ? tag + '.listen' : undefined,
    }).pipe(
      mergeMap(event => {
        return event.type === 'welcome'
          ? fetchFilter().pipe(map(result => ({type: 'sync' as const, result})))
          : of(event)
      }),
      map((event): DocumentIdSetEvent | undefined => {
        if (event.type === 'mutation') {
          if (event.transition === 'update') {
            // ignore updates, as we're only interested in documents appearing and disappearing from the set
            return undefined
          }
          if (event.transition === 'appear') {
            return {
              type: 'op',
              op: 'add',
              documentId: event.documentId,
            }
          }
          if (event.transition === 'disappear') {
            return {
              type: 'op',
              op: 'remove',
              documentId: event.documentId,
            }
          }
          return undefined
        }
        if (event.type === 'sync') {
          return {type: 'sync', documentIds: event.result}
        }
        if (event.type === 'reconnect') {
          return {type: 'reconnect' as const}
        }
        return undefined
      }),
      // ignore undefined
      filter(ev => !!ev),
    )
  }
}
export function createIdSetListenerFromClient(client: SanityClient) {}

/** Converts a stream of id set listener events into a state containing the list of document ids */
export function toState(options: {insert?: InsertMethod} = {}) {
  const {insert: insertOption = 'sorted'} = options
  return (input$: Observable<DocumentIdSetEvent>) =>
    input$.pipe(
      scan((state: DocumentIdSetState, event): DocumentIdSetState => {
        if (event.type === 'reconnect') {
          return {
            ...state,
            event,
            status: 'reconnecting',
          }
        }
        if (event.type === 'sync') {
          return {
            ...state,
            event,
            status: 'connected',
          }
        }
        if (event.type === 'op') {
          if (event.op === 'add') {
            return {
              event,
              status: 'connected',
              snapshot: insert(state.snapshot, event.documentId, insertOption),
            }
          }
          if (event.op === 'remove') {
            return {
              event,
              status: 'connected',
              snapshot: state.snapshot.filter(id => id !== event.documentId),
            }
          }
          throw new Error(`Unexpected operation: ${event.op}`)
        }
        return state
      }, INITIAL_STATE),
    )
}

function insert<T>(array: T[], element: T, strategy: InsertMethod): T[] {
  let index: number
  if (strategy === 'prepend') {
    index = 0
  } else if (strategy === 'append') {
    index = array.length
  } else {
    index = sortedIndex(array, element) as number
  }

  return array.toSpliced(index, 0, element)
}
