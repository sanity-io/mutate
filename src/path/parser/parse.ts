import {PathParseError} from '../errors'
import {type PathElement} from '../types'
import {type StringToPath} from './types'

export function parse<const T extends string>(
  path: T,
): StringToPath<T> | PathParseError {
  const segments = path.split(/[[.\]]/g).filter(Boolean)
  const result: PathElement[] = []
  for (const seg of segments) {
    const element = seg.includes('==') ? parseSegment(seg) : coerce(seg)
    if (element instanceof Error) return element as PathParseError
    result.push(element)
  }
  return result as any
}

const IS_NUMERIC = /^-?\d+$/

function unquote(str: string) {
  return str.replace(/^['"]/, '').replace(/['"]$/, '')
}

function parseSegment(segment: string): PathElement | PathParseError {
  const [key, value] = segment.split('==')
  if (key !== '_key') {
    return new PathParseError({
      reason: `Currently only "_key" is supported as path segment. Found ${key}`,
    })
  }
  if (typeof value === 'undefined') {
    return new PathParseError({
      reason: 'Invalid path segment, expected `key=="value"`',
    })
  }
  return {_key: unquote(value)}
}

function coerce(segment: string): PathElement {
  return IS_NUMERIC.test(segment) ? Number(segment) : segment
}
