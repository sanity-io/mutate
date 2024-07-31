import {at, patch} from '@bjoerge/mutiny'
import {type SanityDocument} from '@sanity/sanitype'
import {Stack} from '@sanity/ui'
import {useCallback} from 'react'

import {type DocumentInputProps, type PatchEvent} from '../../types'
import {Field} from './Field'

export function DocumentInput<T extends SanityDocument>(
  props: DocumentInputProps<T>,
) {
  const {value, onMutation, renderInput} = props
  const handleFieldPatch = useCallback(
    (fieldName: string, patchEvent: PatchEvent) => {
      onMutation({
        mutations: patchEvent.patches.map(nodePatch =>
          patch(value._id, at([fieldName, ...nodePatch.path], nodePatch.op)),
        ),
      })
    },
    [onMutation, value._id],
  )
  return (
    <Stack space={4}>
      {Object.entries(props.form.fields).map(([fieldName, fieldOptions]) => {
        return (
          <Field
            path={[]}
            renderInput={renderInput}
            key={fieldName}
            schema={props.schema.shape[fieldName]!}
            value={value?.[fieldName]}
            onPatch={handleFieldPatch}
            options={fieldOptions}
            name={fieldName}
          />
        )
      })}
    </Stack>
  )
}
