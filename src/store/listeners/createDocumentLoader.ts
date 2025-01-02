import {type SanityClient} from '@sanity/client'
import {keyBy} from 'lodash'
import {map, type Observable} from 'rxjs'

import {type SanityDocumentBase} from '../../mutations/types'
import {createDataLoader} from '../utils/createDataLoader'
import {type DocumentResult} from './types'

export type FetchDocuments = (ids: string[]) => Observable<DocEndpointResponse>

export interface OmittedDocument {
  id: string
  reason: 'existence' | 'permission'
}
export interface DocEndpointResponse {
  documents: SanityDocumentBase[]
  omitted: OmittedDocument[]
}

/**
 * Creates a "dataloader" style document loader that fetches from the /doc endpoint
 * @param {FetchDocuments} fetchDocuments - The client instance used for fetching documents.
 * @param options
 */
export function createDocumentLoader(
  fetchDocuments: FetchDocuments,
  options?: {durationSelector?: () => Observable<unknown>; tag?: string},
) {
  return createDataLoader({
    onLoad: (ids: string[]) => fetchDedupedWith(fetchDocuments, ids),
    durationSelector: options?.durationSelector,
  })
}

export function createDocumentLoaderFromClient(
  client: SanityClient,
  options?: {durationSelector?: () => Observable<unknown>; tag?: string},
) {
  const fetchDocument = (ids: string[]) => {
    const requestOptions = {
      uri: client.getDataUrl('doc', ids.join(',')),
      json: true,
      tag: options?.tag,
    }

    return client.observable.request<DocEndpointResponse>(requestOptions)
  }

  return createDocumentLoader(fetchDocument, options)
}

/**
 * Processes an array of document IDs:
 * 1. Extracts the set of unique IDs from the input array.
 * 2. Calls `fetchDocuments` with the unique IDs to retrieve their corresponding documents.
 * 3. Returns an array of documents, preserving the order and duplication of IDs in the input array.
 *
 * Example:
 * - Input: [a, a, b]
 * - `fetchDocuments` is called with ([a, b]), returning: [{_id: a}, {_id: b}]
 * - Output: [{_id: a}, {_id: a}, {_id: b}]
 *
 * @param {FetchDocuments} fetchDocuments - The client instance used for fetching documents.
 * @param {Array<string>} ids - An array of document IDs to process.
 * @returns {Observable<DocumentResult[]>} - An array of documents, mapped to the input IDs.
 */
function fetchDedupedWith(fetchDocuments: FetchDocuments, ids: string[]) {
  const unique = [...new Set(ids)]
  return fetchDocuments(unique).pipe(
    map(results => prepareResponse(ids, results)),
    map(results => {
      const byId = keyBy(results, result => result.id)
      return ids.map(id => byId[id]!)
    }),
  )
}

function prepareResponse(
  requestedIds: string[],
  response: DocEndpointResponse,
): DocumentResult[] {
  const documents = keyBy(response.documents, entry => entry._id!)
  const omitted = keyBy(response.omitted, entry => entry.id)
  return requestedIds.map(id => {
    if (documents[id]) {
      return {id, accessible: true, document: documents[id]!}
    }
    const omittedEntry = omitted[id]
    if (!omittedEntry) {
      // in case the document is missing and there's no entry for it in `omitted`
      // this should not normally happen, but if it does, handle it is as if the document doesn't exist
      return {id, accessible: false, reason: 'existence'}
    }
    if (omittedEntry.reason === 'permission') {
      return {
        id,
        accessible: false,
        reason: 'permission',
      }
    }
    // handle any unknown omitted reason as nonexistence too
    return {
      id,
      accessible: false,
      reason: 'existence',
    }
  })
}
