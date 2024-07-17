import {at, set, unset} from '@bjoerge/mutiny'
import {type SanityString} from '@sanity/sanitype'
import {TextArea, TextInput} from '@sanity/ui'
import {type FormEventHandler, useCallback} from 'react'

import {type InputProps} from '../types'

export function StringInput(props: InputProps<SanityString>) {
  const {value, onPatch} = props
  const handleChange: FormEventHandler<HTMLInputElement | HTMLTextAreaElement> =
    useCallback(
      event => {
        onPatch({
          patches: [
            at(
              [],
              event.currentTarget.value
                ? set(event.currentTarget.value)
                : unset(),
            ),
          ],
        })
      },
      [onPatch],
    )

  return props.form?.multiline ? (
    <TextArea value={value || ''} rows={5} onChange={handleChange} />
  ) : (
    <TextInput value={value || ''} onChange={handleChange} />
  )
}
