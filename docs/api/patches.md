# Patches

A patch is a node path paired with an operation. Build patches with `at()`, then group them inside a `patch()` mutation.

## `at(path, operation)`

Build a single node patch. The path is either a string in simplified [JSONMatch](https://www.sanity.io/docs/json-match) syntax, or an array of segments:

```ts twoslash
import {at, insert, set} from '@sanity/mutate'

const p1 = at('foo.bar', set('baz'))
const p2 = at(['foo', 'bar'], set('baz'))
const p3 = at(['cities', 0], set('Oslo'))
const p4 = at(['people', {_key: 'xyz'}, 'name'], set('Jane'))
const p5 = at('cities', insert(['Oslo'], 'after', 0))
```

## Path segments

A path is `PathElement[]`, where `PathElement` is `string | number | {_key: string}`:

- `string` — object property
- `number` — array index
- `{_key: string}` — array item by `_key`
