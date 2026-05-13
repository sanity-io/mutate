import {makePatches, stringifyPatches} from '@sanity/diff-match-patch'

import {applyNodePatch, type ApplyPatchError} from '../../../apply'
import {type Operation} from '../../../mutations/operations/types'
import {type NodePatch, type SanityDocumentBase} from '../../../mutations/types'
import {getAtPath, type Path, startsWith, stringify} from '../../../path'
import {takeUntilRight} from '../../utils/arrayUtils'

function isEqualPath(p1: Path, p2: Path) {
  return stringify(p1) === stringify(p2)
}

function supersedes(later: Operation, earlier: Operation) {
  return (
    (earlier.type === 'set' || earlier.type === 'unset') &&
    (later.type === 'set' || later.type === 'unset')
  )
}

export function squashNodePatches(patches: NodePatch[]) {
  return compactSetIfMissingPatches(
    compactSetPatches(compactUnsetPatches(patches)),
  )
}

export function compactUnsetPatches(patches: NodePatch[]) {
  return patches.reduce(
    (earlierPatches: NodePatch[], laterPatch: NodePatch) => {
      if (laterPatch.op.type !== 'unset') {
        earlierPatches.push(laterPatch)
        return earlierPatches
      }
      // find all preceding patches that are affected by this unset
      const unaffected = earlierPatches.filter(
        earlierPatch => !startsWith(laterPatch.path, earlierPatch.path),
      )
      unaffected.push(laterPatch)
      return unaffected
    },
    [],
  )
}

export function compactSetPatches(patches: NodePatch[]) {
  return patches.reduceRight(
    (laterPatches: NodePatch[], earlierPatch: NodePatch) => {
      const replacement = laterPatches.find(
        later =>
          supersedes(later.op, earlierPatch.op) &&
          isEqualPath(later.path, earlierPatch.path),
      )
      if (replacement) {
        // we already have another patch later in the chain that replaces this one
        return laterPatches
      }
      laterPatches.unshift(earlierPatch)
      return laterPatches
    },
    [],
  )
}

export function compactSetIfMissingPatches(patches: NodePatch[]) {
  return patches.reduce(
    (previousPatches: NodePatch[], laterPatch: NodePatch) => {
      if (laterPatch.op.type !== 'setIfMissing') {
        previousPatches.push(laterPatch)
        return previousPatches
      }
      // look at preceding patches up until the first unset
      const check = takeUntilRight(
        previousPatches,
        patch => patch.op.type === 'unset',
      )
      const precedent = check.find(
        precedingPatch =>
          precedingPatch.op.type === 'setIfMissing' &&
          isEqualPath(precedingPatch.path, laterPatch.path),
      )
      if (precedent) {
        // we already have an identical patch earlier in the chain that voids this one
        return previousPatches
      }
      previousPatches.push(laterPatch)
      return previousPatches
    },
    [],
  )
}

export function compactDMPSetPatches(
  base: SanityDocumentBase,
  patches: NodePatch[],
): NodePatch[] | ApplyPatchError {
  let edge = base
  const result: NodePatch[] = []
  for (const patch of patches) {
    const before = edge
    const next = applyNodePatch(patch, edge)
    if (next instanceof Error) return next
    edge = next as SanityDocumentBase
    if (patch.op.type === 'set' && typeof patch.op.value === 'string') {
      const current = getAtPath(patch.path, before)
      if (typeof current === 'string') {
        // we have a set patch that targets a string node
        // we can replace the set patch with a diffMatchPatch going from the
        // current value to the set patch value
        const replaced: NodePatch = {
          ...patch,
          op: {
            type: 'diffMatchPatch',
            value: stringifyPatches(makePatches(current, patch.op.value)),
          },
        }
        const filtered = result.flatMap(ep =>
          isEqualPath(ep.path, patch.path) && ep.op.type === 'diffMatchPatch'
            ? []
            : ep,
        )
        result.length = 0
        result.push(...filtered, replaced)
        continue
      }
    }
    result.push(patch)
  }
  return result
}
