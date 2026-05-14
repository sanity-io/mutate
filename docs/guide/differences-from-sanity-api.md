# Differences from the Sanity API

`@sanity/mutate` is a strict subset of the [Sanity HTTP mutation API](https://www.sanity.io/docs/http-mutations). Every mutation you can build with `@sanity/mutate` can be serialized to the Sanity API via `SanityEncoder`, but the reverse is not true — the Sanity API accepts shapes that don't round-trip through `@sanity/mutate` without an extra conversion step.

In addition, the local apply engine interprets a few patches more strictly than the server does.

## `set` and `setIfMissing` don't create intermediate objects

On the Sanity API, `set` and `setIfMissing` create intermediate empty objects along the path as needed. In `@sanity/mutate`, they only apply when the parent already exists.

```ts twoslash
import {at, patch, set, setIfMissing} from '@sanity/mutate'
import {applyPatchMutation} from '@sanity/mutate/_unstable_apply'

const document = {_id: 'author-1', _type: 'author'} as const

// This is a no-op locally because `address` doesn't exist yet
const noop = applyPatchMutation(
  patch('author-1', [at(['address', 'city'], set('Oslo'))]),
  document,
)

// This creates `address`, then sets `city`
const works = applyPatchMutation(
  patch('author-1', [
    at(['address'], setIfMissing({_type: 'address'})),
    at(['address', 'city'], set('Oslo')),
  ]),
  document,
)
```

Stage the parent's `setIfMissing` higher up the path before the child `set`.

## Patches target a single node

Sanity's mutation API supports [JSONMatch](https://www.sanity.io/docs/json-match) selectors that target multiple nodes at once (e.g. `cities[year > 2020].title`). `@sanity/mutate` patches target one node per `at()` — there's no multi-target selection.

If you need to update many array items, build one patch per item:

```ts twoslash
import {at, patch, set} from '@sanity/mutate'

const keys = ['xyz', 'abc', 'def']
const patches = keys.map(key =>
  at(['people', {_key: key}, 'verified'], set(true)),
)
const mutation = patch('roster-1', patches)
```

## `insertIfMissing` can't be serialized

The Sanity HTTP API has no native `insertIfMissing`. `SanityEncoder.encodeAll()` throws if it encounters one. Use `insertIfMissing` only with the local apply engine and the optimistic store.

## `upsert` does not preserve position over the wire

Locally, `upsert` replaces an existing match in place; on the server, `SanityEncoder` emulates it by `unset` + `insert`, so the item moves to the reference position. If position matters, branch on what you know: `replace` (or `set` on individual fields) when the item exists, `insert` / `append` / `prepend` when it doesn't.

## Listener-emitted patches need conversion

The Sanity listener endpoint emits patches that may contain shapes (multi-target selectors, intermediate-object creation) that aren't expressible as `@sanity/mutate` patches. If you consume listener events directly, expect an intermediate conversion step that takes the current document state into account.
