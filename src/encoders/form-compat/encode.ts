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
  UnsupportedFormPatchPathError,
  UnsupportedFormPatchTypeError,
} from '../errors'
import {
  type CompatPath,
  type FormPatchLike,
  type FormPatchPath,
} from './form-patch-types'

export type FormCompatEncodeError =
  | UnsupportedFormPatchPathError
  | UnsupportedFormPatchTypeError

function assertCompatible(
  formPatchPath: FormPatchPath,
): CompatPath | UnsupportedFormPatchPathError {
  if (formPatchPath.length === 0) {
    return formPatchPath as never[]
  }
  for (const element of formPatchPath) {
    if (Array.isArray(element)) {
      return new UnsupportedFormPatchPathError()
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
export function encodePatches(
  patches: FormPatchLike[],
): NodePatch[] | FormCompatEncodeError {
  const result: NodePatch[] = []
  for (const formPatch of patches) {
    const encoded = encodePatch(formPatch)
    if (encoded instanceof Error) return encoded
    result.push(encoded)
  }
  return result
}

function encodePatch(
  formPatch: FormPatchLike,
): NodePatch | FormCompatEncodeError {
  const path = assertCompatible(formPatch.path)
  if (path instanceof Error) return path
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
  return new UnsupportedFormPatchTypeError({
    // @ts-expect-error - should be exhaustive
    type: formPatch.type,
  })
}
