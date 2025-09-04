import {type PatchMutationOperation} from '@sanity/client'

import {
  type Mutation,
  type NodePatch,
  type Transaction,
} from '../../mutations/types'
import {stringify as stringifyPath} from '../../path/parser/stringify'
import {type SanityMutation} from './types'

export function encode(mutation: Mutation): SanityMutation[] | SanityMutation {
  return encodeMutation(mutation)
}

export function encodeAll(mutations: Mutation[]): SanityMutation[] {
  return mutations.flatMap(encode)
}

export function encodeTransaction(transaction: Transaction) {
  return {
    transactionId: transaction.id,
    mutations: encodeAll(transaction.mutations),
  }
}

export function encodeMutation(
  mutation: Mutation,
): SanityMutation[] | SanityMutation {
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
      return mutation.patches.map(patch => {
        return {
          patch: {
            id: mutation.id,
            ...(ifRevisionID && {ifRevisionID}),
            ...patchToSanity(patch),
          },
        } as {id: string; patch: PatchMutationOperation}
      })
    }
  }
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
  //@ts-expect-error all cases should be covered
  throw new Error(`Unknown operation type ${op.type}`)
}
