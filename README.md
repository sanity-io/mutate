<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/public/mark-display-dark.svg">
    <img src="docs/public/mark-display-light.svg" alt="@sanity/mutate" width="144" height="144">
  </picture>
</p>

# @sanity/mutate

> [!NOTE]
> Experimental. Use at your own risk.

A TypeScript toolkit for [Sanity](https://sanity.io) mutations:

- Declarative, composable mutation creators
- A pure, in-memory apply engine
- An optimistic local store with rebase semantics

## Install

```sh
npm install @sanity/mutate
```

## Example

```ts
import {
  at,
  create,
  createIfNotExists,
  patch,
  SanityEncoder,
  set,
  setIfMissing,
} from '@sanity/mutate'

const projectId = '<projectId>'
const dataset = '<dataset>'

const mutations = [
  create({_type: 'dog', name: 'Fido'}),
  createIfNotExists({_id: 'document-1', _type: 'someType'}),
  patch('other-document', [
    at('published', set(true)),
    at('address', setIfMissing({_type: 'address'})),
    at('address.city', set('Oslo')),
  ]),
]

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

## Documentation

Full reference and guides at **<https://sanity-io.github.io/mutate>** (sources in [`docs/`](./docs); run the site locally with `pnpm docs:dev`):

- [Getting Started](https://sanity-io.github.io/mutate/guide/getting-started)
- [Applying Mutations](https://sanity-io.github.io/mutate/guide/applying-mutations) — in-memory apply
- [Optimistic Store](https://sanity-io.github.io/mutate/guide/optimistic-store) — local replica with rebase
- [Recipes](https://sanity-io.github.io/mutate/guide/recipes)
- [Differences from the Sanity API](https://sanity-io.github.io/mutate/guide/differences-from-sanity-api)
- API reference: [mutations](https://sanity-io.github.io/mutate/api/mutations), [patches](https://sanity-io.github.io/mutate/api/patches), [operations](https://sanity-io.github.io/mutate/api/operations), [encoders](https://sanity-io.github.io/mutate/api/encoders)

## License

MIT
