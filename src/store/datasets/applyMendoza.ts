import {applyPatch} from 'mendoza'
import type {SanityDocumentBase} from '../../mutations/types'
import type {RawPatch} from 'mendoza'

function omitRev(document: SanityDocumentBase | undefined) {
  if (document === undefined) {
    return undefined
  }
  const {_rev, ...doc} = document
  return doc
}

export function applyMendozaPatch(
  document: SanityDocumentBase | undefined,
  patch: RawPatch,
): SanityDocumentBase | undefined {
  const next = applyPatch(omitRev(document), patch)
  return next === null ? undefined : next
}
