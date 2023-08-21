import {parse as parsePath} from '../../path/parse'
import type {
  CompactMutation,
  CompactPatchMutation,
  CreateIfNotExistsMutation,
  CreateMutation,
  CreateOrReplaceMutation,
  DeleteMutation,
} from './types'

import type {
  Mutation,
  PatchMutation,
  SanityDocument,
} from '../../mutations/types'

export {Mutation, SanityDocument}

export function decode<Doc extends SanityDocument>(
  mutations: CompactMutation<Doc>[],
): Mutation[] {
  return mutations.map(decodeMutation)
}

export function decodeMutation<Doc extends SanityDocument>(
  mutation: CompactMutation<Doc>,
): Mutation {
  const [type] = mutation
  if (type === 'delete') {
    const [, id] = mutation as DeleteMutation
    return {id, type}
  } else if (type === 'create') {
    const [, document] = mutation as CreateMutation<Doc>
    return {type, document}
  } else if (type === 'createIfNotExists') {
    const [, document] = mutation as CreateIfNotExistsMutation<Doc>
    return {type, document}
  } else if (type === 'createOrReplace') {
    const [, document] = mutation as CreateOrReplaceMutation<Doc>
    return {type, document}
  } else if (type === 'patch') {
    return decodePatchMutation(mutation)
  }
  throw new Error(`Unrecognized mutation: ${JSON.stringify(mutation)}`)
}

function decodePatchMutation(mutation: CompactPatchMutation): PatchMutation {
  const [, type, id, serializedPath, , revisionId] = mutation

  const path = parsePath(serializedPath)
  if (type === 'dec' || type === 'inc') {
    const [, , , , [amount]] = mutation
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'inc', amount}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'unset') {
    return {
      type: 'patch',
      id,
      patches: [{path, op: {type: 'unset'}}],
      ...createOpts(revisionId),
    }
  }
  if (type === 'insert') {
    const [, , , , [position, ref, items]] = mutation
    return {
      type: 'patch',
      id,
      patches: [
        {
          path,
          op: {
            type: 'insert',
            position,
            items,
            referenceItem: typeof ref === 'string' ? {_key: ref} : ref,
          },
        },
      ],
      ...createOpts(revisionId),
    }
  }
  if (type === 'set') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [
        {
          path,
          op: {type: 'set', value},
        },
      ],
      ...createOpts(revisionId),
    }
  }
  if (type === 'setIfMissing') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [
        {
          path,
          op: {type: 'setIfMissing', value},
        },
      ],
      ...createOpts(revisionId),
    }
  }
  if (type === 'diffMatchPatch') {
    const [, , , , [value]] = mutation
    return {
      type: 'patch',
      id,
      patches: [
        {
          path,
          op: {type: 'diffMatchPatch', value},
        },
      ],
      ...createOpts(revisionId),
    }
  }
  if (type === 'truncate') {
    throw new Error('TODO')
  }
  if (type === 'assign') {
    throw new Error('TODO')
  }
  if (type === 'replace') {
    throw new Error('TODO')
  }
  throw new Error(`Invalid mutation type: ${type}`)
}

function createOpts(revisionId: undefined | string) {
  return revisionId ? {options: {ifRevision: revisionId}} : null
}
