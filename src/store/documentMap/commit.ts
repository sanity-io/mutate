import {type SanityDocumentBase} from '../../mutations/types'
import {type DocumentMap} from '../types'
import {type UpdateResult} from './applyMutations'

export function commit<Doc extends SanityDocumentBase>(
  results: UpdateResult<Doc>[],
  documentMap: DocumentMap<Doc>,
) {
  results.forEach(result => {
    if (result.status === 'created' || result.status === 'updated') {
      documentMap.set(result.id, result.after)
    }
    if (result.status === 'deleted') {
      documentMap.delete(result.id)
    }
  })
}
