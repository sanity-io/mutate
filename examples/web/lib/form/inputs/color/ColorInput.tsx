import {at, set, setIfMissing, unset} from '@sanity/mutate'
import {type FormEventHandler, useCallback} from 'react'

import {type InputProps} from '../../types'
import {type AnyColorSchema} from './schema'

export function ColorInput<T extends AnyColorSchema>(props: InputProps<T>) {
  const {value, onPatch} = props
  const handleChange: FormEventHandler<HTMLInputElement | HTMLTextAreaElement> =
    useCallback(
      event => {
        onPatch({
          patches: [
            at(
              [],
              setIfMissing({
                _type: 'color',
              }),
            ),
            at(
              ['hex'],
              event.currentTarget.value
                ? set(event.currentTarget.value)
                : unset(),
            ),
          ],
        })
      },
      [onPatch],
    )

  return <input type="color" value={value?.hex || ''} onChange={handleChange} />
}
