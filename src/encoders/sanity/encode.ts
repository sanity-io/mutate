import {stringify as stringifyPath} from '../../path/stringify'
import type {Mutation, NodePatch} from '../../mutations/types'

export function encode(mutations: Mutation[]) {
  return mutations.flatMap(encodeMutation)
}

export function encodeMutation(mutation: Mutation) {
  if (
    mutation.type === 'create' ||
    mutation.type === 'createIfNotExists' ||
    mutation.type === 'createOrReplace'
  ) {
    return {[mutation.type]: mutation.document}
  }
  if (mutation.type === 'delete') {
    return {
      delete: {id: mutation.id},
    }
  }
  return mutation.patches.map(patch => ({
    patch: {id: mutation.id, ...patchToSanity(patch)},
  }))
}

function patchToSanity(patch: NodePatch) {
  const {path, op} = patch
  if (op.type === 'unset') {
    return {unset: [stringifyPath(path)]}
  }
  if (op.type === 'insert') {
    return {
      insert: {
        [op.position]: stringifyPath([...path, op.referenceItem]),
        items: op.items,
      },
    }
  }
  if (op.type === 'diffMatchPatch') {
    return {diffMatchPatch: {[stringifyPath(path)]: op.value}}
  }
  if (op.type === 'inc') {
    return {inc: {[stringifyPath(path)]: op.amount}}
  }
  if (op.type === 'dec') {
    return {dec: {[stringifyPath(path)]: op.amount}}
  }
  if (op.type === 'set' || op.type === 'setIfMissing') {
    return {[op.type]: {[stringifyPath(path)]: op.value}}
  }
  if (op.type === 'truncate') {
    const range = [
      op.startIndex,
      typeof op.endIndex === 'number' ? op.endIndex : '',
    ].join(':')

    return {unset: [`${stringifyPath(path)}[${range}]`]}
  }
  if (op.type === 'upsert') {
    // note: upsert currently not supported by sanity, so will always insert at reference position
    return {
      unset: op.items.map(item => stringifyPath([...path, {_key: item._key}])),
      insert: {
        [op.position]: stringifyPath([...path, op.referenceItem]),
        items: op.items,
      },
    }
  }
  if (op.type === 'assign') {
    throw new Error('TODO')
  }
  if (op.type === 'unassign') {
    throw new Error('TODO')
  }
  if (op.type === 'replace') {
    throw new Error('TODO')
  }
  //@ts-expect-error all cases should be covered
  throw new Error(`Unknown operation type ${op.type}`)
}
