import {
  literal,
  object,
  type SanityLiteral,
  type SanityObject,
  type SanityString,
  string,
} from '@sanity/sanitype'

export function color<const Name extends string>(name: Name) {
  return object({
    _type: literal(name),
    hex: string(),
  })
}

export type AnyColorSchema = SanityObject<{
  _type: SanityLiteral<string>
  hex: SanityString
}>
