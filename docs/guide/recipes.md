# Recipes

Patterns that combine the primitives in useful ways.

## Patch a document without reading it first

When you only need to change a few fields and don't care about the current state of the document, build the patch and submit it. The Content Lake applies it to whatever the document looks like at that moment:

```ts twoslash
import {at, patch, SanityEncoder, set, setIfMissing} from '@sanity/mutate'

const mutation = patch('author-1', [
  at(['name'], set('Jane Doe')),
  at(['updatedAt'], set(new Date().toISOString())),
  at(['metadata'], setIfMissing({})),
  at(['metadata', 'verified'], set(true)),
])

const projectId = '<projectId>'
const dataset = '<dataset>'

await fetch(
  `https://${projectId}.api.sanity.io/v2026-05-12/data/mutate/${dataset}`,
  {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({mutations: SanityEncoder.encodeAll([mutation])}),
  },
)
```

> [!NOTE]
> `set` / `setIfMissing` / `unset` / `assign` / `unassign` / `inc` / `dec` don't need to know the current value. `append` and `prepend` only need the target array to exist — pair them with a `setIfMissing(<path>, [])` if it might not. Operations that target a specific existing item by `_key` or index (`insert`, `insertBefore` / `insertAfter`, `replace`, `remove`, `upsert`) do depend on the current array contents.

## Apply the same patch to many documents

A patch is a plain value. Build the list of operations once, then build one `patch()` mutation per document:

```ts twoslash
import {at, patch, set, setIfMissing} from '@sanity/mutate'

const patches = [
  at(['metadata'], setIfMissing({})),
  at(['metadata', 'published'], set(true)),
  at(['metadata', 'publishedAt'], set(new Date().toISOString())),
]

const documentIds = ['document-1', 'document-2', 'document-3']
const mutations = documentIds.map(id => patch(id, patches))
```

Submit `mutations` to the [Sanity HTTP mutation API](https://www.sanity.io/docs/http-mutations) via `SanityEncoder.encodeAll(mutations)`. If you also need to keep a local view in sync, hand the mutations to the [optimistic store](./optimistic-store) instead of submitting them yourself.

## Preview locally without submitting

When the local result doesn't need to coordinate with the Content Lake — a one-off transformation script, a unit test, a derived view computed from a snapshot — apply mutations directly with `applyInCollection`:

```ts twoslash
import {at, patch, set} from '@sanity/mutate'
import {applyInCollection} from '@sanity/mutate/_unstable_apply'

const initial = [{_id: 'author-1', _type: 'author', name: 'Jane'}]

const mutations = [patch('author-1', [at(['name'], set('Jane Doe'))])]

const next = applyInCollection(initial, mutations)
```

> [!NOTE]
> If the local view also needs to stay in sync with the Content Lake, use the [optimistic store](./optimistic-store) instead. Applying locally and submitting separately drifts as soon as remote events land between the two.

## Convert Studio form patches to `NodePatch`

If you're consuming form patches from a Sanity Studio input, use `FormCompatEncoder` to convert them before passing them to `patch()`:

```ts twoslash
import {FormCompatEncoder, patch} from '@sanity/mutate'

const formPatches: FormCompatEncoder.FormPatchLike[] = [
  {type: 'set', path: ['name'], value: 'Jane'},
]

const nodePatches = FormCompatEncoder.encodePatches(formPatches)
const mutation = patch('author-1', nodePatches)
```
