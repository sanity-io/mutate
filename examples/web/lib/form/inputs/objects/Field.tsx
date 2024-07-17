import {
  type CommonFieldOptions,
  type Infer,
  type SanityAny,
  type SanityFormDef,
  type SanityType,
} from '@sanity/sanitype'
import {Stack, Text} from '@sanity/ui'
import {type ComponentType, memo, useCallback, useMemo} from 'react'

import {type InputProps, type PatchEvent} from '../../types'

export type FieldProps<Schema extends SanityAny> = {
  schema: Schema
  name: string
  value?: Infer<Schema>
  options: CommonFieldOptions
  onPatch: (fieldName: string, patchEvent: PatchEvent) => void
  // onMutate: (mutationEvent: MutationEvent) => void // todo: consider support for patching other documents too
  resolveInput: <T extends SanityAny>(schema: T) => ComponentType<InputProps<T>>
}

export const Field = memo(function Field<Schema extends SanityType>(
  props: FieldProps<Schema>,
) {
  const {schema, name, value, resolveInput, onPatch, options} = props

  const handlePatch = useCallback(
    (patchEvent: PatchEvent) => onPatch(name, patchEvent),
    [name, onPatch],
  )
  const Input = useMemo(() => resolveInput(schema), [resolveInput, schema])
  return (
    <Stack space={3}>
      <label>
        <Text size={1} weight="semibold">
          {options.title}
        </Text>
      </label>
      <Input
        schema={schema}
        onPatch={handlePatch}
        value={value}
        resolveInput={resolveInput}
        form={options.form as SanityFormDef<Schema>}
      />
    </Stack>
  )
})
