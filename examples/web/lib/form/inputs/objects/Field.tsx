import {type Path} from '@bjoerge/mutiny'
import {
  type CommonFormOptions,
  type Infer,
  type SanityAny,
  type SanityFormDef,
  type SanityType,
} from '@sanity/sanitype'
import {Stack, Text} from '@sanity/ui'
import {memo, type ReactNode, useCallback, useMemo} from 'react'

import {type InputProps, type PatchEvent} from '../../types'

export type FieldProps<Schema extends SanityAny> = {
  schema: Schema
  name: string
  value?: Infer<Schema>
  options: CommonFormOptions
  path: Path
  onPatch: (fieldName: string, patchEvent: PatchEvent) => void
  // onMutate: (mutationEvent: MutationEvent) => void // todo: consider support for patching other documents too
  renderInput: <T extends InputProps<SanityAny>>(props: T) => ReactNode
}

export const Field = memo(function Field<Schema extends SanityType>(
  props: FieldProps<Schema>,
) {
  const {schema, name, value, renderInput, onPatch, path, options} = props

  const handlePatch = useCallback(
    (patchEvent: PatchEvent) => onPatch(name, patchEvent),
    [name, onPatch],
  )
  const input = useMemo(
    () =>
      renderInput({
        schema,
        renderInput,
        onPatch: handlePatch,
        value,
        path: [...path, name],
        form: options as SanityFormDef<Schema>,
      }),
    [handlePatch, name, options, path, renderInput, schema, value],
  )
  return (
    <Stack space={3}>
      <label>
        <Text size={1} weight="semibold">
          {options.title}
        </Text>
      </label>
      {input}
    </Stack>
  )
})
