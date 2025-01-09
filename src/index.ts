import * as CompactEncoder from './encoders/compact'
import * as FormCompatEncoder from './encoders/form-compat'
import * as SanityEncoder from './encoders/sanity'
import * as CompactFormatter from './formatters/compact'

export * from './mutations/autoKeys'
export * from './mutations/creators'
export * from './mutations/operations/creators'
export {CompactEncoder, FormCompatEncoder, SanityEncoder}

export {CompactFormatter}

// -- support types --
// eslint-disable-next-line import/export
export type * from './mutations/operations/types' // todo: fix duplicate exports
export type * from './mutations/types'
export type * from './path/get/types'
export type * from './path/parser/types'
// eslint-disable-next-line import/export
export type * from './path/types' // todo: fix duplicate exports
export type {Arrify} from './utils/arrify'
export type {
  AnyArray,
  ArrayElement,
  NormalizeReadOnlyArray,
  Optional,
  Tuplify,
} from './utils/typeUtils'
// /-- support types --
