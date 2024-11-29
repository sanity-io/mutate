import {at, setIfMissing} from '@sanity/mutate'
import {getInstanceName, type SanityObject} from '@sanity/sanitype'
import {Card, Stack} from '@sanity/ui'
import {useCallback} from 'react'

import {type InputProps, type PatchEvent} from '../../types'
import {Field} from './Field'

export function ObjectInput<T extends SanityObject>(props: InputProps<T>) {
  const {schema, onPatch, value, renderInput, path} = props
  const handleFieldPatch = useCallback(
    (fieldName: string, patchEvent: PatchEvent) => {
      const instanceName = getInstanceName(schema)

      onPatch({
        patches: [
          at([], setIfMissing(instanceName ? {_type: instanceName} : {})),
          ...patchEvent.patches.map(patch =>
            at([fieldName, ...patch.path], patch.op),
          ),
        ],
      })
    },
    [schema, onPatch],
  )
  return (
    <Card paddingLeft={3} borderLeft>
      <Stack space={4}>
        {Object.entries(props.form.fields).map(([fieldName, fieldOptions]) => {
          return (
            <Field
              path={path}
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
    </Card>
  )
}
