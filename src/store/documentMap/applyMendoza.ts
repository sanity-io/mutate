import {applyPatch, type RawPatch} from 'mendoza'

import {type SanityDocumentBase} from '../../mutations/types'

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
): SanityDocumentBase | undefined {
  if (patchBaseRev !== document?._rev) {
    throw new Error(
      'Invalid document revision. The provided patch is calculated from a different revision than the current document',
    )
  }
  const next = applyPatch(omitRev(document), patch)
  return next === null ? undefined : next
}

export function applyMutationEventEffects(
  document: SanityDocumentBase | undefined,
  event: {effects: {apply: RawPatch}; previousRev?: string; resultRev?: string},
) {
  if (!event.effects) {
    throw new Error(
      'Mutation event is missing effects. Is the listener set up with effectFormat=mendoza?',
    )
  }
  const next = applyMendozaPatch(
    document,
    event.effects.apply,
    event.previousRev,
  )
  // next will be undefined in case of deletion
  return next ? {...next, _rev: event.resultRev} : undefined
}
