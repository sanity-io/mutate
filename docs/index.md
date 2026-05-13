---
layout: home

hero:
  name: '@sanity/mutate'
  text: Toolkit for Sanity mutations
  tagline: Mutation creators, an in-memory apply engine, and an optimistic local store.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/sanity-io/mutate

features:
  - title: Mutation creators
    details: Build mutations from creator functions. Mutations are plain values; pass them around, transform them, compose them across documents.
  - title: Typed paths and operations
    details: Paths and operations keep their literal types end to end. Apply a patch to a typed document and the result type reflects the change.
  - title: Apply in memory
    details: Pure functions for applying mutations to in-memory documents. Sub-trees the mutation doesn't touch keep their object identity.
  - title: Optimistic store
    details: In-memory dataset replica with rebase semantics on top of the Sanity listener endpoint.
---

## Example

```ts twoslash
import {
  at,
  create,
  createIfNotExists,
  patch,
  SanityEncoder,
  set,
  setIfMissing,
} from '@sanity/mutate'

const patches = [
  at('published', set(true)),
  at('address', setIfMissing({_type: 'address'})),
  at('address.city', set('Oslo')),
]
const mutations = [
  create({_type: 'dog', name: 'Fido'}),
  createIfNotExists({_id: 'document-1', _type: 'someType'}),
  patch('other-document', patches),
]
const payload = SanityEncoder.encodeAll(mutations)
```

> [!NOTE]
> `@sanity/mutate` is experimental. Expect API changes between minor versions.
