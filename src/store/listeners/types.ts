import {type Observable} from 'rxjs'

import {type SanityDocumentBase} from '../../mutations/types'

export interface AccessibleDocumentResult {
  id: string
  document: SanityDocumentBase
  accessible: true
}

export type InaccessibleReason = 'existence' | 'permission'

export interface InaccessibleDocumentResult {
  accessible: false
  id: string
  reason: InaccessibleReason
}

export type DocumentResult =
  | AccessibleDocumentResult
  | InaccessibleDocumentResult

export type DocumentLoader = (documentIds: string) => Observable<DocumentResult>
