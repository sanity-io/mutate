import {parse} from './parse'
import type {KeyedPathElement, Path, PathElement} from './types'

export function normalize(path: string | Readonly<Path>): Readonly<Path> {
  return typeof path === 'string' ? parse(path) : path
}

export function isKeyedElement(
  element: PathElement,
): element is KeyedPathElement {
  return typeof element === 'object' && '_key' in element
}

export function isArrayElement(
  element: PathElement,
): element is KeyedPathElement | number {
  return typeof element === 'number' || isKeyedElement(element)
}

export function isPropertyElement(element: PathElement): element is string {
  return typeof element === 'string'
}
