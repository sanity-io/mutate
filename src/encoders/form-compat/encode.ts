import {at} from '../../mutations/creators'
import {
  diffMatchPatch,
  insert,
  set,
  setIfMissing,
  unset,
} from '../../mutations/operations/creators'
import {type NodePatch} from '../../mutations/types'
import {type KeyedPathElement} from '../../path'
import {
  type CompatPath,
  type FormPatchLike,
  type FormPatchPath,
} from './form-patch-types'

function assertCompatible(formPatchPath: FormPatchPath): CompatPath {
  if (formPatchPath.length === 0) {
    return formPatchPath as never[]
  }
  for (const element of formPatchPath) {
    if (Array.isArray(element)) {
      throw new Error('Form patch paths cannot include arrays')
    }
  }
  return formPatchPath as CompatPath
}

/**
 * Convert a Sanity form patch (ie emitted from an input component) to a {@link NodePatch}
 * Note the lack of encodeMutation here. Sanity forms never emit *mutations*, only patches
 * @param patches - Array of {@link FormPatchLike}
 * @internal
 */
export function encodePatches(patches: FormPatchLike[]): NodePatch[] {
  return patches.map(formPatch => {
    const path = assertCompatible(formPatch.path)
    if (formPatch.type === 'unset') {
      return at(path, unset())
    }
    if (formPatch.type === 'set') {
      return at(path, set(formPatch.value))
    }
    if (formPatch.type === 'setIfMissing') {
      return at(path, setIfMissing(formPatch.value))
    }
    if (formPatch.type === 'insert') {
      const arrayPath = path.slice(0, -1)
      const itemRef = formPatch.path[formPatch.path.length - 1]
      return at(
        arrayPath,
        insert(
          formPatch.items,
          formPatch.position,
          itemRef as number | KeyedPathElement,
        ),
      )
    }
    if (formPatch.type === 'diffMatchPatch') {
      return at(path, diffMatchPatch(formPatch.value))
    }
    // @ts-expect-error - should be exhaustive
    throw new Error(`Unknown patch type ${formPatch.type}`)
  })
}
