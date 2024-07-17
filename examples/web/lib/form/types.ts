import {type Mutation, type NodePatch} from '@bjoerge/mutiny'
import {
  type Infer,
  type SanityAny,
  type SanityDocument,
  type SanityFormDef,
} from '@sanity/sanitype'
import {type ComponentType} from 'react'

export type DocumentInputProps<Schema extends SanityDocument> = {
  schema: Schema
  form: SanityFormDef<Schema>
  value: Infer<Schema>
  onMutation: (mutationEvent: MutationEvent) => void
  // onMutate: (mutationEvent: MutationEvent) => void // todo: consider support for patching other documents too
  resolveInput: <T extends SanityAny>(schema: T) => ComponentType<InputProps<T>>
}

export type InputProps<Schema extends SanityAny> = {
  schema: Schema
  form: SanityFormDef<Schema>
  value?: Infer<Schema>
  onPatch: (patchEvent: PatchEvent) => void
  // onMutate: (mutationEvent: MutationEvent) => void // todo: consider support for patching other documents too
  resolveInput: <T extends SanityAny>(schema: T) => ComponentType<InputProps<T>>
}

export type MutationEvent = {
  mutations: Mutation[]
}

export type PatchEvent = {
  patches: NodePatch[]
}
