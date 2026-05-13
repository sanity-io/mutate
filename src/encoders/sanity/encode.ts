import {type PatchMutationOperation} from '@sanity/client'

import {
  type Mutation,
  type NodePatch,
  type Transaction,
} from '../../mutations/types'
import {stringify as stringifyPath} from '../../path/parser/stringify'
import {
  UnsupportedEncodeOperationError,
  UnsupportedSanityOperationError,
} from '../errors'
import {type SanityMutation} from './types'

export type SanityEncodeError =
  | UnsupportedEncodeOperationError
  | UnsupportedSanityOperationError

export function encode(
  mutation: Mutation,
): SanityMutation[] | SanityMutation | SanityEncodeError {
  return encodeMutation(mutation)
}

export function encodeAll(
  mutations: Mutation[],
): SanityMutation[] | SanityEncodeError {
  const result: SanityMutation[] = []
  for (const m of mutations) {
    const encoded = encode(m)
    if (encoded instanceof Error) return encoded
    if (Array.isArray(encoded)) result.push(...encoded)
    else result.push(encoded)
  }
  return result
}

export function encodeTransaction(transaction: Transaction) {
  const mutations = encodeAll(transaction.mutations)
  if (mutations instanceof Error) return mutations
  return {
    transactionId: transaction.id,
    mutations,
  }
}

export function encodeMutation(
  mutation: Mutation,
): SanityMutation[] | SanityMutation | SanityEncodeError {
  switch (mutation.type) {
    case 'create':
      return {[mutation.type]: mutation.document}
    case 'createIfNotExists':
      return {[mutation.type]: mutation.document}
    case 'createOrReplace':
      return {[mutation.type]: mutation.document}
    case 'delete':
      return {
        delete: {id: mutation.id},
      }
    case 'patch': {
      const ifRevisionID = mutation.options?.ifRevision
      const result: {id: string; patch: PatchMutationOperation}[] = []
      for (const patch of mutation.patches) {
        const encoded = encodePatch(patch)
        if (encoded instanceof Error) return encoded
        result.push({
          patch: {
            id: mutation.id,
            ...(ifRevisionID && {ifRevisionID}),
            ...encoded,
          },
        } as {id: string; patch: PatchMutationOperation})
      }
      return result
    }
  }
}

export function encodePatch(patch: NodePatch) {
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
      unset: op.items.map(item =>
        stringifyPath([...path, {_key: (item as any)._key}]),
      ),
      insert: {
        [op.position]: stringifyPath([...path, op.referenceItem]),
        items: op.items,
      },
    }
  }
  if (op.type === 'assign') {
    return {
      set: Object.fromEntries(
        Object.keys(op.value).map(key => [
          stringifyPath(path.concat(key)),
          op.value[key as keyof typeof op.value],
        ]),
      ),
    }
  }
  if (op.type === 'unassign') {
    return {
      unset: op.keys.map(key => stringifyPath(path.concat(key))),
    }
  }
  if (op.type === 'replace') {
    return {
      insert: {
        replace: stringifyPath(path.concat(op.referenceItem)),
        items: op.items,
      },
    }
  }
  if (op.type === 'remove') {
    return {
      unset: [stringifyPath(path.concat(op.referenceItem))],
    }
  }
  if (op.type === 'insertIfMissing') {
    return new UnsupportedSanityOperationError({operation: 'insertIfMissing'})
  }
  return new UnsupportedEncodeOperationError({
    //@ts-expect-error all cases should be covered
    type: op.type,
  })
}
