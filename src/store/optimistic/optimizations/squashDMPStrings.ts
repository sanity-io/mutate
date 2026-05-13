import {type ApplyPatchError} from '../../../apply'
import {
  type Mutation,
  type NodePatch,
  type PatchMutation,
  type SanityDocumentBase,
} from '../../../mutations/types'
import {type MutationGroup} from '../../types'
import {compactDMPSetPatches} from './squashNodePatches'

export interface DataStore {
  get: (id: string) => SanityDocumentBase | undefined
}
export function squashDMPStrings(
  base: DataStore,
  mutationGroups: MutationGroup[],
): MutationGroup[] | ApplyPatchError {
  const result: MutationGroup[] = []
  for (const mutationGroup of mutationGroups) {
    const mutations = dmpIfyMutations(base, mutationGroup.mutations)
    if (mutations instanceof Error) return mutations
    result.push({...mutationGroup, mutations})
  }
  return result
}

export function dmpIfyMutations(
  store: DataStore,
  mutations: Mutation[],
): Mutation[] | ApplyPatchError {
  const result: Mutation[] = []
  for (const mutation of mutations) {
    if (mutation.type !== 'patch') {
      result.push(mutation)
      continue
    }
    const base = store.get(mutation.id)
    if (!base) {
      result.push(mutation)
      continue
    }
    const dmp = dmpifyPatchMutation(base, mutation)
    if (dmp instanceof Error) return dmp
    result.push(dmp)
  }
  return result
}

export function dmpifyPatchMutation(
  base: SanityDocumentBase,
  mutation: PatchMutation,
): PatchMutation | ApplyPatchError {
  const patches = compactDMPSetPatches(base, mutation.patches as NodePatch[])
  if (patches instanceof Error) return patches
  return {
    ...mutation,
    patches,
  }
}
