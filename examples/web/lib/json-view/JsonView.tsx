import {type CSSProperties} from 'react'
import {ReactJason} from 'react-jason'
import styled from 'styled-components'

export const sharedRoot: CSSProperties = {
  fontFeatureSettings: '"liga" 0, "calt" 0',
  whiteSpace: 'pre',
  margin: 0,
}

const theme = {
  styles: {
    root: sharedRoot,
    attribute: {color: '#b8860b'},
    unquotedAttribute: {color: '#b8860b'},
    string: {color: '#008000'},
    nil: {color: '#806600'},
    number: {color: 'blue'},
    boolean: {color: '#008080'},
    punctuation: {color: '#888'},
  },
}

const OnelineWrapper = styled.span`
  pre {
    white-space: normal !important;
    display: inline;
  }
`

export function JsonView(props: {value: any; oneline?: boolean}) {
  const jason = (
    <ReactJason value={props.value} theme={theme} quoteAttributes={false} />
  )

  return props.oneline ? <OnelineWrapper>{jason}</OnelineWrapper> : jason
}
