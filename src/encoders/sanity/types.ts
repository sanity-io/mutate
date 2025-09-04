import {
  type Mutation as SanityMutation,
  type PatchMutationOperation,
  type PatchOperations,
} from '@sanity/client'

import {
  type IdentifiedSanityDocument,
  type SanityDocumentBase,
} from '../../mutations/types'

export type {PatchMutationOperation, SanityMutation}

export type SanityDiffMatchPatch = {
  id: string
  diffMatchPatch: {[path: string]: string}
}

export type SanitySetPatch = {
  id: string
  set: {[path: string]: any}
}

export type InsertBefore = {
  before: string
  items: any[]
}

export type InsertAfter = {
  after: string
  items: any[]
}

export type InsertReplace = {
  replace: string
  items: any[]
}

export type Insert = InsertBefore | InsertAfter | InsertReplace

export type SanityInsertPatch = {
  id: string
  insert: Insert
}

export type SanityUnsetPatch = {
  id: string
  unset: string[]
}

export type SanityIncPatch = {
  id: string
  inc: {[path: string]: number}
}

export type SanityDecPatch = {
  id: string
  dec: {[path: string]: number}
}

export type SanitySetIfMissingPatch = {
  id: string
  setIfMissing: {[path: string]: any}
}

export type SanityPatch = PatchOperations & {id: string}

export type SanityCreateIfNotExistsMutation<
  Doc extends IdentifiedSanityDocument = IdentifiedSanityDocument,
> = {
  createIfNotExists: Doc
}

export type SanityCreateOrReplaceMutation<
  Doc extends IdentifiedSanityDocument = IdentifiedSanityDocument,
> = {
  createOrReplace: Doc
}

export type SanityCreateMutation<Doc extends SanityDocumentBase> = {
  create: Doc
}

export type SanityDeleteMutation = {
  delete: {id: string}
}
