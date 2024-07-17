import {
  boolean,
  document,
  literal,
  object,
  optional,
  string,
  union,
} from '@sanity/sanitype'

export const address = object({
  street: string(),
  city: string(),
  country: string(),
})

export const person = document({
  _type: literal('person'),
  name: string(),
  bio: optional(
    union([
      object({
        _type: literal('code'),
        text: string(),
        language: union([literal('js'), literal('ts'), literal('py')]),
        author: string(),
      }),
      object({
        _type: literal('paragraph'),
        text: string(),
        author: string(),
      }),
      object({
        _type: literal('blockquote'),
        text: string(),
        style: union([literal('normal'), literal('fancy')]),
        author: string(),
      }),
    ]),
  ),
  address,
  favoritePet: optional(
    union([
      object({
        _type: literal('feline'),
        name: string(),
        meows: boolean(),
      }),
      object({
        _type: literal('canine'),
        name: string(),
        barks: boolean(),
      }),
      object({
        _type: literal('avine'),
        name: string(),
        squawks: boolean(),
      }),
    ]),
  ),
})
