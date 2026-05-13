import {type ApplyPatchError, applyPatches} from '../../apply'
import {type NodePatch, type SanityDocumentBase} from '../../mutations/types'
import {getAtPath} from '../../path'
import {applyAll} from '../documentMap/applyDocumentMutation'
import {
  type ApplyMutationFailedError,
  RebaseDmpApplyError,
  type UnknownMutationTypeError,
} from '../errors'
import {type MutationGroup} from '../types'
import {getMutationDocumentId} from '../utils/getMutationDocumentId'
import {compactDMPSetPatches} from './optimizations/squashNodePatches'

export type RebaseError =
  | RebaseDmpApplyError
  | ApplyMutationFailedError
  | ApplyPatchError
  | UnknownMutationTypeError

export function rebase(
  documentId: string,
  oldBase: SanityDocumentBase | undefined,
  newBase: SanityDocumentBase | undefined,
  localMutations: readonly MutationGroup[],
):
  | [newLocal: MutationGroup[], rebased: SanityDocumentBase | undefined]
  | RebaseError {
  // 1. get the dmpified mutations from the newStage based on the old base
  // 2. apply those to the new base
  // 3. convert those back into set patches based on the new base and return as a new newStage
  let edge = oldBase
  const dmpified: {transaction: MutationGroup; mutations: any[]}[] = []
  for (const transaction of localMutations) {
    const mutations: any[] = []
    for (const mut of transaction.mutations) {
      const mid = getMutationDocumentId(mut)
      if (mid instanceof Error) return mid
      if (mid !== documentId) {
        continue
      }
      const before = edge
      const applied = applyAll(edge, [mut])
      if (applied instanceof Error) return applied as RebaseError
      edge = applied
      if (!before) {
        mutations.push(mut)
        continue
      }
      if (mut.type !== 'patch') {
        mutations.push(mut)
        continue
      }
      const dmpPatches = compactDMPSetPatches(
        before,
        mut.patches as NodePatch[],
      )
      if (dmpPatches instanceof Error) return dmpPatches
      mutations.push({
        type: 'dmpified' as const,
        mutation: {
          ...mut,
          // Todo: make compactDMPSetPatches return pairs of patches that was dmpified with their
          //  original as dmpPatches and original is not 1:1 (e..g some of the original may not be dmpified)
          dmpPatches,
          original: mut.patches,
        },
      })
    }
    dmpified.push({transaction, mutations})
  }

  let newBaseWithDMPForOldBaseApplied: SanityDocumentBase | undefined = newBase
  // NOTE: It might not be possible to apply them - if so, we fall back to applying the pending changes
  // todo: revisit this
  for (const entry of dmpified) {
    for (const mut of entry.mutations) {
      if (mut.type === 'dmpified') {
        // go through all dmpified, try to apply, if they fail, use the original un-optimized set patch instead
        const dmpResult = applyPatches(
          mut.mutation.dmpPatches,
          newBaseWithDMPForOldBaseApplied,
        )
        if (!(dmpResult instanceof Error)) {
          newBaseWithDMPForOldBaseApplied = dmpResult as SanityDocumentBase
          continue
        }
        // eslint-disable-next-line no-console
        console.warn('Failed to apply dmp patch, falling back to original')
        const fallback = applyPatches(
          mut.mutation.original,
          newBaseWithDMPForOldBaseApplied,
        )
        if (fallback instanceof Error) {
          return new RebaseDmpApplyError({
            documentId,
            reason: fallback.message,
            cause: fallback,
          })
        }
        newBaseWithDMPForOldBaseApplied = fallback as SanityDocumentBase
      } else {
        const next = applyAll(newBaseWithDMPForOldBaseApplied, [mut])
        if (next instanceof Error) return next as RebaseError
        newBaseWithDMPForOldBaseApplied = next
      }
    }
  }

  const newStage = localMutations.map((transaction): MutationGroup => {
    // update all set patches to set to the current value
    return {
      ...transaction,
      mutations: transaction.mutations.map(mut => {
        const mid = getMutationDocumentId(mut)
        // mid was already validated above; treat error as non-match here
        if (mid instanceof Error) return mut
        if (mut.type !== 'patch' || mid !== documentId) {
          return mut
        }
        return {
          ...mut,
          patches: mut.patches.map(patch => {
            if (patch.op.type !== 'set') {
              return patch
            }
            return {
              ...patch,
              op: {
                ...patch.op,
                value: getAtPath(patch.path, newBaseWithDMPForOldBaseApplied),
              },
            }
          }),
        }
      }),
    }
  })
  return [newStage, newBaseWithDMPForOldBaseApplied]
}
