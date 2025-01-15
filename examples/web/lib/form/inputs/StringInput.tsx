import {at, set, unset} from '@sanity/mutate'
import {type SanityString} from '@sanity/sanitype'
import {TextArea, TextInput} from '@sanity/ui'
import {
  type FormEventHandler,
  type ForwardedRef,
  forwardRef,
  useCallback,
} from 'react'
import {createMultiplayerInput} from 'react-multiplayer-input'

import {type InputProps} from '../types'

const MultiplayerTextInput = createMultiplayerInput(TextInput)
const MultiplayerTextArea = createMultiplayerInput(TextArea)

export const StringInput = forwardRef(function StringInput(
  props: InputProps<SanityString>,
  forwardedRef: ForwardedRef<HTMLInputElement | HTMLTextAreaElement>,
) {
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
    <MultiplayerTextArea
      elementRef={
        (forwardedRef as ForwardedRef<HTMLTextAreaElement>) || undefined
      }
      value={value || ''}
      rows={8}
      onChange={handleChange}
    />
  ) : (
    <MultiplayerTextInput
      elementRef={forwardedRef as ForwardedRef<HTMLInputElement>}
      value={value || ''}
      onChange={handleChange}
    />
  )
})
