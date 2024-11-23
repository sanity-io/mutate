import {type SanityClient} from '@sanity/client'
import {keyBy} from 'lodash'
import {map, type Observable} from 'rxjs'

import {type SanityDocumentBase} from '../../mutations/types'
import {createDataLoader} from '../utils/createDataLoader'
import {type DocumentResult} from './types'

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
 * @param {Object} client - The client instance used for fetching documents.
 * @param {Array} ids - An array of document IDs to process.
 * @param {Object} [options] - Additional options for the fetch operation.
 * @returns {Array} - An array of documents, mapped to the input IDs.
 */
function dedupedFetchDocuments(
  client: SanityClient,
  ids: string[],
  options?: {tag?: string},
) {
  const unique = [...new Set(ids)]
  return fetchDocuments(client, unique, options).pipe(
    map(results => {
      const byId = keyBy(results, result => result.id)
      return ids.map(id => byId[id]!)
    }),
  )
}

/**
 * Creates a "dataloader" style document loader that fetches from the /doc endpoint
 * @param options
 */
export function createDocumentLoader(options: {
  client: SanityClient
  tag?: string
  durationSelector?: () => Observable<unknown>
}) {
  const {client, tag} = options
  return createDataLoader({
    onLoad: (ids: string[]) => dedupedFetchDocuments(client, ids, {tag}),
  })
}

interface OmittedDocument {
  id: string
  reason: 'existence' | 'permission'
}
interface DocEndpointResponse {
  documents: SanityDocumentBase[]
  omitted: OmittedDocument[]
}

function fetchDocuments(
  client: SanityClient,
  ids: string[],
  options?: {tag?: string},
): Observable<DocumentResult[]> {
  const requestOptions = {
    uri: client.getDataUrl('doc', ids.join(',')),
    json: true,
    tag: options?.tag,
  }
  return client.observable.request<DocEndpointResponse>(requestOptions).pipe(
    map(response => {
      const documents = keyBy(response.documents, entry => entry._id!)
      const omitted = keyBy(response.omitted, entry => entry.id)
      return ids.map(id => {
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
    }),
  )
}
