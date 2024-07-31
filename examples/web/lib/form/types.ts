import {type Mutation, type NodePatch, type Path} from '@bjoerge/mutiny'
import {
  type Infer,
  type SanityAny,
  type SanityDocument,
  type SanityFormDef,
} from '@sanity/sanitype'
import {type ReactNode} from 'react'

export type InputProps<Schema extends SanityAny> = {
  schema: Schema
  form: SanityFormDef<Schema>
  value?: Infer<Schema>
  onPatch: (patchEvent: PatchEvent) => void
  path: Path
  // onMutate: (mutationEvent: MutationEvent) => void // todo: consider support for patching other documents too
  renderInput: <T extends InputProps<SanityAny>>(inputProps: T) => ReactNode
}

export type DocumentInputProps<Schema extends SanityDocument = SanityDocument> =
  {
    schema: Schema
    form: SanityFormDef<Schema>
    value: Infer<Schema>

    onMutation: (mutationEvent: MutationEvent) => void
    // onMutate: (mutationEvent: MutationEvent) => void // todo: consider support for patching other documents too
    renderInput: <T extends InputProps<SanityAny>>(inputProps: T) => ReactNode
  }

export type MutationEvent = {
  mutations: Mutation[]
}

export type PatchEvent = {
  patches: NodePatch[]
}
