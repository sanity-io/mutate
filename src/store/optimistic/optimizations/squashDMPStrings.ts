import {
  type Mutation,
  type NodePatch,
  type PatchMutation,
  type SanityDocumentBase,
} from '../../../mutations/types'
import {type MutationGroup} from '../../types'
import {compactDMPSetPatches} from './squashNodePatches'

interface DataStore {
  get: (id: string) => SanityDocumentBase | undefined
}
export function squashDMPStrings(
  base: DataStore,
  mutationGroups: MutationGroup[],
): MutationGroup[] {
  return mutationGroups.map(mutationGroup => ({
    ...mutationGroup,
    mutations: dmpIfyMutations(base, mutationGroup.mutations),
  }))
}

export function dmpIfyMutations(
  store: DataStore,
  mutations: Mutation[],
): Mutation[] {
  return mutations.map((mutation, i) => {
    if (mutation.type !== 'patch') {
      return mutation
    }
    const base = store.get(mutation.id)
    return base ? dmpifyPatchMutation(base, mutation) : mutation
  })
}

export function dmpifyPatchMutation(
  base: SanityDocumentBase,
  mutation: PatchMutation,
): PatchMutation {
  return {
    ...mutation,
    patches: compactDMPSetPatches(base, mutation.patches as NodePatch[]),
  }
}
