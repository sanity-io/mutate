import {applyPatch, type RawPatch} from 'mendoza'

import {type SanityDocumentBase} from '../../mutations/types'
import {
  MendozaMissingEffectsError,
  MendozaRevisionMismatchError,
} from '../errors'

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
  patchBaseRev?: string,
): SanityDocumentBase | undefined | MendozaRevisionMismatchError {
  if (patchBaseRev !== document?._rev) {
    return new MendozaRevisionMismatchError()
  }
  const next = applyPatch(omitRev(document), patch)
  return next === null ? undefined : next
}

export function applyMutationEventEffects(
  document: SanityDocumentBase | undefined,
  event: {effects: {apply: RawPatch}; previousRev?: string; resultRev?: string},
):
  | SanityDocumentBase
  | undefined
  | MendozaMissingEffectsError
  | MendozaRevisionMismatchError {
  if (!event.effects) {
    return new MendozaMissingEffectsError()
  }
  const next = applyMendozaPatch(
    document,
    event.effects.apply,
    event.previousRev,
  )
  if (next instanceof Error) return next
  // next will be undefined in case of deletion
  return next ? {...next, _rev: event.resultRev} : undefined
}
