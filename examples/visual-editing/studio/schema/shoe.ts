import {
  document,
  literal,
  object,
  optional,
  string,
  union,
} from '@sanity/sanitype'

export const airmax = object({
  _type: literal('airmax'),
  color: optional(string()),
  gel: optional(string()),
})

export const dunklow = object({
  _type: literal('dunklow'),
  coatBack: optional(string()),
  coatFront: optional(string()),
  coatMiddle: optional(string()),
  inner: optional(string()),
  laces: optional(string()),
  neck: optional(string()),
  nikeLogo: optional(string()),
  nikeText: optional(string()),
  patch: optional(string()),
  soleBottom: optional(string()),
  soleTop: optional(string()),
  towel: optional(string()),
})

export const ultraboost = object({
  _type: literal('ultraboost'),
  band: optional(string()),
  caps: optional(string()),
  inner: optional(string()),
  laces: optional(string()),
  mesh: optional(string()),
  patch: optional(string()),
  sole: optional(string()),
  stripes: optional(string()),
})

export const shoe = document({
  _type: literal('shoe'),
  name: string(),
  model: optional(union([airmax, dunklow, ultraboost])),
})
