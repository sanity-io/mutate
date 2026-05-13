import {type PathParseError} from '../errors'
import {parse} from '../parser/parse'
import {type Path} from '../types'

export function normalize(
  path: string | Readonly<Path>,
): Readonly<Path> | PathParseError {
  return typeof path === 'string'
    ? (parse(path) as Path | PathParseError)
    : path
}
