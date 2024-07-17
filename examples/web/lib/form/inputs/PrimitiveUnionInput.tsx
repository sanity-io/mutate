import {at, set, unset} from '@bjoerge/mutiny'
import {isLiteralSchema, type SanityPrimitiveUnion} from '@sanity/sanitype'
import {Box, Flex, Select, Stack} from '@sanity/ui'
import {useCallback} from 'react'

import {type InputProps} from '../types'

export function PrimitiveUnionInput(props: InputProps<SanityPrimitiveUnion>) {
  const {value, schema, onPatch, form} = props

  const handleReplaceType = useCallback(
    (nextValue: string) =>
      onPatch({
        patches: [at([], nextValue === '' ? unset() : set(nextValue))],
      }),
    [onPatch],
  )

  const literalTypes = schema.union.filter(isLiteralSchema)
  // todo: support non-literal primitives
  return (
    <Stack space={3}>
      <Flex align="center" gap={2}>
        <Select
          value={String(value) || ''}
          space={[3, 3, 4]}
          onChange={e => handleReplaceType(e.currentTarget.value)}
        >
          <option value="">{value ? '' : 'Select…'}</option>
          {literalTypes.map((ut, i) => {
            const literalValue = String(ut.value)
            return (
              <option key={i} value={literalValue}>
                {((form as any).types as any)[literalValue]?.title}
              </option>
            )
          })}
        </Select>
      </Flex>
      <Box></Box>
    </Stack>
  )
}
