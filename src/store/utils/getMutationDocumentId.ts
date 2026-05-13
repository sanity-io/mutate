import {UnknownMutationTypeError} from '../errors'

type MutationLike =
  | {type: 'patch'; id: string}
  | {type: 'create'; document: {_id: string}}
  | {type: 'delete'; id: string}
  | {type: 'createIfNotExists'; document: {_id: string}}
  | {type: 'createOrReplace'; document: {_id: string}}

export function getMutationDocumentId(
  mutation: MutationLike,
): string | UnknownMutationTypeError {
  if (mutation.type === 'patch') {
    return mutation.id
  }
  if (mutation.type === 'create') {
    return mutation.document._id
  }
  if (mutation.type === 'delete') {
    return mutation.id
  }
  if (mutation.type === 'createIfNotExists') {
    return mutation.document._id
  }
  if (mutation.type === 'createOrReplace') {
    return mutation.document._id
  }
  return new UnknownMutationTypeError({type: (mutation as any).type})
}
