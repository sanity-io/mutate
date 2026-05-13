# Getting started

`@sanity/mutate` is an experimental toolkit for working with [Sanity](https://sanity.io) mutations in JavaScript and TypeScript. It contains:

- Mutation creator functions
- Pure functions for applying mutations to in-memory documents
- An optimistic local store with rebase semantics

## Install

::: code-group

```sh [npm]
npm install @sanity/mutate
```

```sh [pnpm]
pnpm add @sanity/mutate
```

```sh [yarn]
yarn add @sanity/mutate
```

```sh [bun]
bun add @sanity/mutate
```

:::

## A first mutation

Mutations are plain values built from creator functions. A `patch` mutation describes one or more operations against a single document:

```ts twoslash
import {at, patch, set, setIfMissing} from '@sanity/mutate'

const patches = [
  at('name', set('Jane')),
  at('address', setIfMissing({_type: 'address'})),
  at('address.city', set('Oslo')),
]
const mutation = patch('author-1', patches)
```

## Applying a mutation locally

`applyPatchMutation` runs a patch against an in-memory document and returns the next state. The result type reflects the operations applied — hover `authorAfter` below to see the inferred type, including the new `address` object:

```ts twoslash
import {at, patch, set, setIfMissing} from '@sanity/mutate'
import {applyPatchMutation} from '@sanity/mutate/_unstable_apply'

const authorBefore = {
  _id: 'author-1',
  _type: 'author',
  name: 'Jane',
} as const

const mutation = patch('author-1', [
  at(['name'], set('Jane Doe')),
  at(['address'], setIfMissing({_type: 'address'})),
  at(['address', 'city'], set('Oslo')),
])
const authorAfter = applyPatchMutation(mutation, authorBefore)
//    ^?
//
//
//
//
//
//
//
//
//
//
//
```

See [Applying mutations](./applying-mutations) for collection-level apply and the referential-integrity contract.

## Sending mutations to Sanity

`SanityEncoder.encodeAll` converts mutations to the [Sanity HTTP mutation API](https://www.sanity.io/docs/http-mutations) payload shape:

```ts twoslash
import {at, patch, SanityEncoder, set} from '@sanity/mutate'

const projectId = '<projectId>'
const dataset = '<dataset>'

const mutations = [patch('author-1', [at('name', set('Jane'))])]

await fetch(
  `https://${projectId}.api.sanity.io/v2026-05-12/data/mutate/${dataset}`,
  {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(SanityEncoder.encodeAll(mutations)),
  },
)
```

## Paths

A patch targets a single node, addressed by a path. A path is either a string in a simplified [JSONMatch](https://www.sanity.io/docs/json-match) syntax, or an array of segments:

```ts twoslash
import {at, insert, set} from '@sanity/mutate'

at('foo.bar', set('baz'))
at(['foo', 'bar'], set('baz'))

at(['cities', 0], set('Oslo'))

// Address an array item by _key
at(['people', {_key: 'xyz'}, 'name'], set('Jane'))
at('people[_key=="xyz"].name', set('Jane'))

at('cities', insert(['Oslo'], 'after', 0))
```

## Next

- [Applying mutations](./applying-mutations) — apply mutations to in-memory documents
- [Optimistic store](./optimistic-store) — in-memory dataset replica with rebase semantics
- [Recipes](./recipes) — patterns that combine the primitives
- [Differences from the Sanity API](./differences-from-sanity-api) — local apply caveats and serialization limits
- [API reference](/api/mutations) — creator and operation reference
