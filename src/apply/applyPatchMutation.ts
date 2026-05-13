import {type PatchMutation, type SanityDocumentBase} from '../mutations/types'
import {type NormalizeReadOnlyArray} from '../utils/typeUtils'
import {
  type ApplyPatchError,
  DocumentIdMismatchError,
  RevisionMismatchError,
} from './errors'
import {applyPatches} from './patch/applyNodePatch'
import {type ApplyPatches} from './patch/typings/applyNodePatch'

export type ApplyPatchMutation<
  Mutation extends PatchMutation,
  Doc extends SanityDocumentBase,
> =
  Mutation extends PatchMutation<infer Patches>
    ? ApplyPatches<NormalizeReadOnlyArray<Patches>, Doc>
    : Doc

export type ApplyPatchMutationError =
  | RevisionMismatchError
  | DocumentIdMismatchError
  | ApplyPatchError

export function applyPatchMutation<
  const Mutation extends PatchMutation,
  const Doc extends SanityDocumentBase,
>(
  mutation: Mutation,
  document: Doc,
): ApplyPatchMutation<Mutation, Doc> | ApplyPatchMutationError {
  if (
    mutation.options?.ifRevision &&
    document._rev !== mutation.options.ifRevision
  ) {
    return new RevisionMismatchError({
      expected: mutation.options.ifRevision,
      actual: document._rev ?? 'undefined',
    })
  }
  if (mutation.id !== document._id) {
    return new DocumentIdMismatchError({
      mutationId: mutation.id,
      documentId: document._id ?? 'undefined',
    })
  }
  return applyPatches(mutation.patches, document) as any
}
