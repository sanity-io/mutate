import {type PathElement} from '../path'
import {at} from './creators'
import {set, setIfMissing} from './operations/creators'
import {type AnyOp} from './operations/types'

type PathElementWithDefault<DefaultValue = unknown> = [
  PathElement,
  DefaultValue,
]

export function atWithDefaults(
  pathWithDefaults: PathElementWithDefault[],
  target: PathElement,
  op: AnyOp,
) {
  return [
    ...pathWithDefaults.map(([element, defaultValue]) =>
      at([element], setIfMissing(defaultValue)),
    ),
    at([target], op),
  ]
}

const patch = atWithDefaults([
  ['foo', setIfMissing({_type: 'hi'})],
  ['bar', setIfMissing({_type: 'bar'})],
  ['someArray', setIfMissing([])],
  [{_key: 'foo'}, setIfMissing({_type: 'itemType'})],
  ['firstName', set('someName')],
])
