import * as DMP from 'diff-match-patch'
import type {DiffMatchPatchOp} from '../../../mutations/operations/types'

const dmp = new DMP.diff_match_patch()

export function diffMatchPatch<
  O extends DiffMatchPatchOp,
  CurrentValue extends string,
>(op: O, currentValue: CurrentValue) {
  if (typeof currentValue !== 'string') {
    throw new TypeError('Cannot apply "diffMatchPatch()" on non-string value')
  }

  return dmp.patch_apply(dmp.patch_fromText(op.value), currentValue)[0]
}
