import {applyPatches, parsePatch} from '@sanity/diff-match-patch'

import {type DiffMatchPatchOp} from '../../../mutations/operations/types'
import {TypeMismatchError} from '../../errors'

export function diffMatchPatch<
  O extends DiffMatchPatchOp,
  CurrentValue extends string,
>(op: O, currentValue: CurrentValue) {
  if (typeof currentValue !== 'string') {
    return new TypeMismatchError({
      operation: 'diffMatchPatch',
      expectedType: 'string',
      actualType: typeof currentValue,
    })
  }

  return applyPatches(parsePatch(op.value), currentValue)[0]
}
