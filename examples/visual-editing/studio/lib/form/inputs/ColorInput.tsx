import {at, set, unset} from '@sanity/mutate'
import {type SanityString} from '@sanity/sanitype'
import {Inline, Text} from '@sanity/ui'
import defaultColors from 'nice-color-palettes'
import {transparentize} from 'polished'
import {
  type FormEventHandler,
  useCallback,
  useDeferredValue,
  useId,
} from 'react'
import {styled} from 'styled-components'

import {type InputProps} from '../types'

export function ColorInput(props: InputProps<SanityString>) {
  const {value, onPatch} = props
  const deferredValue = useDeferredValue(value)
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
  const inputId = useId()
  const presetId = useId()

  return (
    <Inline space={2}>
      <StyledColorInput
        id={inputId}
        value={value || ''}
        onChange={handleChange}
        list={
          // @ts-expect-error this is fine, preset exists
          typeof props.form?.preset === 'number' ? presetId : undefined
        }
      />
      <Text as="output" htmlFor={inputId} size={0}>
        {deferredValue}
      </Text>
      {
        // @ts-expect-error this fine, preset exists
        typeof props.form?.preset === 'number' && (
          <datalist id={presetId}>
            {defaultColors.map((colors, i) => {
              const color =
                colors[
                  // @ts-expect-error this fine, preset exists
                  props.form?.preset as unknown as number
                ]
              return <option key={`${i}-${color}`} value={color} />
            })}
          </datalist>
        )
      }
    </Inline>
  )
}

const StyledColorInput = styled.input.attrs({type: 'color'})`
  cursor: pointer;
  box-sizing: border-box;
  background: var(--card-border-color);
  border: 0 solid transparent;
  border-radius: 2px;
  padding: 0;
  appearance: none;
  margin: 0;
  height: 1.6rem;
  width: 8ch;

  &:hover {
    box-shadow: 0 0 0 2px ${({theme}) => theme.sanity.color.card.hovered.border};
  }

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    padding: 0;
    border: 0 solid transparent;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px
      ${({theme}) => transparentize(0.8, theme.sanity.color.card.enabled.fg)};
  }

  &::-moz-color-swatch {
    padding: 0;
    border: 0 solid transparent;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px
      ${({theme}) => transparentize(0.8, theme.sanity.color.card.enabled.fg)};
  }
`
