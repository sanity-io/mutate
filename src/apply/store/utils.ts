import type {StoredDocument} from '../applyInIndex'
import type {SanityDocumentBase} from '../../mutations/types'

export function hasId(doc: SanityDocumentBase): doc is StoredDocument {
  return '_id' in doc
}
export function assignId<Doc extends SanityDocumentBase>(
  doc: Doc,
  generateId: () => string,
): Doc & {_id: string} {
  return hasId(doc) ? doc : {...doc, _id: generateId()}
}
