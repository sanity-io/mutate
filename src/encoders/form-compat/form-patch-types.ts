/**
 * Inlined from the 'sanity' package
 */
import {type ElementType} from '../../path'

/**
 * @deprecated
 */
export type FormPatchPathKeyedSegment = {_key: string}
/**
 * @deprecated
 */
export type FormPatchPathIndexTuple = [number | '', number | '']

/**
 * @deprecated
 */
export type FormPatchPathSegment =
  | string
  | number
  | FormPatchPathKeyedSegment
  | FormPatchPathIndexTuple

/**
 * @deprecated
 */
export type FormPatchPath = FormPatchPathSegment[]

/**
 * A variant of the FormPath type that never contains index tupes
 */
export type CompatPath = Exclude<
  ElementType<FormPatchPath>,
  FormPatchPathIndexTuple
>[]

/**
 *
 * @internal
 * @deprecated
 */
export type FormPatchJSONValue =
  | number
  | string
  | boolean
  | {[key: string]: FormPatchJSONValue}
  | FormPatchJSONValue[]

/**
 *
 * @internal
 * @deprecated
 */
export type FormPatchOrigin = 'remote' | 'local' | 'internal'

/**
 *
 * @internal
 * @deprecated
 */
export interface FormSetPatch {
  path: FormPatchPath
  type: 'set'
  value: FormPatchJSONValue
}

/**
 *
 * @internal
 * @deprecated
 */
export interface FormIncPatch {
  path: FormPatchPath
  type: 'inc'
  value: FormPatchJSONValue
}

/**
 *
 * @internal
 * @deprecated
 */
export interface FormDecPatch {
  path: FormPatchPath
  type: 'dec'
  value: FormPatchJSONValue
}

/**
 *
 * @internal
 * @deprecated
 */
export interface FormSetIfMissingPatch {
  path: FormPatchPath
  type: 'setIfMissing'
  value: FormPatchJSONValue
}

/**
 *
 * @internal
 * @deprecated
 */
export interface FormUnsetPatch {
  path: FormPatchPath
  type: 'unset'
}

/**
 *
 * @internal
 * @deprecated
 */
export type FormInsertPatchPosition = 'before' | 'after'

/**
 *
 * @internal
 * @deprecated
 */
export interface FormInsertPatch {
  path: FormPatchPath
  type: 'insert'
  position: FormInsertPatchPosition
  items: FormPatchJSONValue[]
}

/**
 *
 * @internal
 * @deprecated
 */
export interface FormDiffMatchPatch {
  path: FormPatchPath
  type: 'diffMatchPatch'
  value: string
}

/**
 *
 * @internal
 * @deprecated
 */
export type FormPatchLike =
  | FormSetPatch
  | FormSetIfMissingPatch
  | FormUnsetPatch
  | FormInsertPatch
  | FormDiffMatchPatch
