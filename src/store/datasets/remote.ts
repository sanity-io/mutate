import type {Dataset} from '../types'
import type {SanityDocumentBase} from '../../mutations/types'

/**
 * This represents all the remote versions of the documents currently active
 */
export function createRemoteDataset() {
  const documents: Dataset<SanityDocumentBase> = new Map()
  return {
    set: (id: string, document: SanityDocumentBase | undefined) =>
      void documents.set(id, document),
    get: (id: string) => documents.get(id),
  }
}
