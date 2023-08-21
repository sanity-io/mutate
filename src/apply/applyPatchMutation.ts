import {applyPatches} from './patch/applyPatch'
import type {PatchMutation, SanityDocument} from '../mutations/types'

export function applyPatchMutation<
  Doc extends SanityDocument,
  Mutation extends PatchMutation,
>(document: Doc, mutation: Mutation): Doc {
  if (
    mutation.options?.ifRevision &&
    document._rev !== mutation.options.ifRevision
  ) {
    throw new Error('Revision mismatch')
  }
  if (mutation.id !== document._id) {
    throw new Error(
      `Document id mismatch. Refusing to apply mutation for document with id="${mutation.id}" on the given document with id="${document._id}"`,
    )
  }
  return applyPatches(mutation.patches, document)
}
