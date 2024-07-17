import {at, set} from '@bjoerge/mutiny'
import {type SanityBoolean} from '@sanity/sanitype'
import {Checkbox} from '@sanity/ui'
import {type FormEventHandler, useCallback} from 'react'

import {type InputProps} from '../types'

export function BooleanInput(props: InputProps<SanityBoolean>) {
  const {onPatch} = props
  const handleChange: FormEventHandler<HTMLInputElement> = useCallback(
    event => {
      onPatch({patches: [at([], set(event.currentTarget.checked))]})
    },
    [onPatch],
  )
  return <Checkbox checked={props.value || false} onChange={handleChange} />
}
