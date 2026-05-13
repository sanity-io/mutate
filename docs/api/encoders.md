# Encoders

Mutations are plain descriptions of operations. Encoders serialize them to different targets:

- `SanityEncoder` — the [Sanity HTTP mutation API](https://www.sanity.io/docs/http-mutations) payload
- `CompactEncoder` — a compact JSON form
- `FormCompatEncoder` — converts Sanity form patches to `@sanity/mutate` `NodePatch`es

## SanityEncoder

`encodeAll(mutations)` converts an array of mutations to the Sanity HTTP API payload shape:

```ts twoslash
import {at, patch, SanityEncoder, set} from '@sanity/mutate'

const mutations = [patch('author-1', [at('name', set('Jane'))])]
const payload = SanityEncoder.encodeAll(mutations)
```

## CompactEncoder

`encode(mutations)` converts mutations to the compact JSON form. `decode` is the inverse.

```ts twoslash
import {at, CompactEncoder, patch, set} from '@sanity/mutate'

const mutations = [patch('author-1', [at('name', set('Jane'))])]
const payload = CompactEncoder.encode(mutations)
```

## FormCompatEncoder

Sanity Studio input components emit form patches. `encodePatches(patches)` converts an array of those into `NodePatch[]` that you can pass to `patch()`:

```ts twoslash
import {FormCompatEncoder, patch} from '@sanity/mutate'

const formPatches: FormCompatEncoder.FormPatchLike[] = [
  {type: 'set', path: ['name'], value: 'Jane'},
]
const nodePatches = FormCompatEncoder.encodePatches(formPatches)
const mutation = patch('author-1', nodePatches)
```
