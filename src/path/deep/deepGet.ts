import type {AnyArray} from '../../utils/typeUtils'
import type {FindInArray} from './common'
import type {KeyedPathElement, Path, PathElement} from '../types'

export type Get<
  P extends number | KeyedPathElement | Readonly<KeyedPathElement> | string,
  T,
> = T extends AnyArray
  ? P extends KeyedPathElement | Readonly<KeyedPathElement> | number
    ? FindInArray<P, T>
    : undefined
  : P extends keyof T
  ? T[P]
  : never

export type DeepGet<P extends readonly PathElement[], T> = P extends []
  ? T
  : P extends [infer Head, ...infer Tail]
  ? Head extends PathElement
    ? Tail extends PathElement[]
      ? DeepGet<Tail, Get<Head, T>>
      : undefined
    : undefined
  : undefined

export function deepGet<T>(path: [], value: T): T
export function deepGet<const Head extends PathElement, const T>(
  path: [head: Head],
  value: T,
): Get<Head, T>
export function deepGet<
  const Head extends PathElement,
  const Tail extends PathElement[],
  T,
>(path: [head: Head, ...tail: Tail], value: T): DeepGet<[Head, ...Tail], T>
export function deepGet(path: Path, value: any): any {
  return 'TODO' as any
}
