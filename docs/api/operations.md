# Operations

An operation is the change applied at a node — `set`, `unset`, `insert`, and so on. Pair an operation with a path via `at()` to form a patch.

## Any type

### `set(value)`

Set the node to `value`.

```ts twoslash
import {at, set} from '@sanity/mutate'

at('name', set('Jane'))
```

> [!NOTE]
> `set` does not create intermediate empty objects. If a parent object on the path doesn't already exist, the patch has no effect. Use `setIfMissing` higher up the path to create it.

### `setIfMissing(value)`

Set the node to `value` if it has no current value. Otherwise do nothing.

```ts twoslash
import {at, setIfMissing} from '@sanity/mutate'

at('address', setIfMissing({_type: 'address'}))
```

> [!NOTE]
> Like `set`, `setIfMissing` only applies when its parent already exists.

### `unset()`

Remove the node from the document.

```ts twoslash
import {at, unset} from '@sanity/mutate'

at('nickname', unset())
```

## Objects

### `assign(value)`

Shallow-merge `value` into the existing object, like `Object.assign`.

```ts twoslash
import {assign, at} from '@sanity/mutate'

at('address', assign({city: 'Oslo'}))
```

### `unassign(attributes)`

Remove the given keys from the existing object.

```ts twoslash
import {at, unassign} from '@sanity/mutate'

at('address', unassign(['zip', 'country']))
```

## Arrays

### `prepend(items)` / `append(items)`

Add items to the start or end of an array.

```ts twoslash
import {append, at, prepend} from '@sanity/mutate'

at('cities', prepend(['Oslo']))
at('cities', append(['Tokyo', 'Madrid']))
```

### `insert(items, position, referenceItem)`

Insert items `'before'` or `'after'` a reference item, addressed by index or by `{_key}`.

```ts twoslash
import {at, insert} from '@sanity/mutate'

at('cities', insert(['Oslo'], 'after', 0))
at('people', insert([{_type: 'person', name: 'Jane'}], 'before', {_key: 'xyz'}))
```

> [!NOTE]
> Throws if the target is not an array, or if `referenceItem` is not found.

### `insertBefore(items, referenceItem)` / `insertAfter(items, referenceItem)`

Shorthands for `insert(items, 'before', referenceItem)` and `insert(items, 'after', referenceItem)`.

```ts twoslash
import {at, insertAfter, insertBefore} from '@sanity/mutate'

at('cities', insertBefore(['Oslo'], 0))
at('people', insertAfter([{_type: 'person', name: 'Jane'}], {_key: 'xyz'}))
```

### `upsert(items, position, referenceItem)`

For each item, if an item with the same `_key` already exists, it is replaced in place. Otherwise the item is inserted at `position` relative to `referenceItem`.

```ts twoslash
import {at, upsert} from '@sanity/mutate'

at(
  'people',
  upsert([{_key: 'jane', _type: 'person', name: 'Jane'}], 'after', {
    _key: 'john',
  }),
)
```

> [!NOTE]
> Every item must have a `_key`. Existing items keep their index — `position` and `referenceItem` only apply to items being inserted.

> [!WARNING]
> The Sanity HTTP API has no native `upsert`, so `SanityEncoder` emulates it by `unset`-ing existing matches and then `insert`-ing at `position` / `referenceItem`. Existing matches **lose their original position** on the server — the in-place semantics only apply locally.

### `insertIfMissing(items, position, referenceItem)`

Insert items whose `_key` isn't already in the array. Items whose `_key` already exists are not modified.

```ts twoslash
import {at, insertIfMissing} from '@sanity/mutate'

at(
  'people',
  insertIfMissing([{_key: 'jane', _type: 'person', name: 'Jane'}], 'after', {
    _key: 'john',
  }),
)
```

> [!NOTE]
> Every item must have a `_key`. Use `upsert` if you want existing items to be replaced with new field values.

> [!WARNING]
> `insertIfMissing` cannot be serialized to the Sanity HTTP API — `SanityEncoder.encodeAll()` throws on it. Use it with local apply only (`applyPatchMutation`, the optimistic store).

### `replace(items, referenceItem)`

Replace one item, addressed by index or by `{_key}`, with one or more new items.

```ts twoslash
import {at, replace} from '@sanity/mutate'

at('cities', replace(['Bergen'], 0))
```

> [!NOTE]
> Throws if `referenceItem` is not found.

### `remove(referenceItem)`

Remove a single array item, addressed by index or by `{_key}`.

```ts twoslash
import {at, remove} from '@sanity/mutate'

at('cities', remove(0))
at('people', remove({_key: 'xyz'}))
```

> [!NOTE]
> Throws if `referenceItem` is not found.

### `truncate(startIndex, endIndex?)`

Remove items from `startIndex` (inclusive) up to `endIndex` (exclusive). Omit `endIndex` to remove everything from `startIndex` onward.

```ts twoslash
import {at, truncate} from '@sanity/mutate'

at('cities', truncate(2))
at('cities', truncate(2, 5))
```

## Numbers

### `inc(value)` / `dec(value)`

Increment or decrement a number by `value`.

```ts twoslash
import {at, dec, inc} from '@sanity/mutate'

at('views', inc(1))
at('stock', dec(2))
```

## Strings

### `diffMatchPatch(patch)`

Apply an incremental text patch. See [diff-match-patch](https://www.sanity.io/docs/http-patches#aTbJhlAJ) for the patch format.

```ts twoslash
import {at, diffMatchPatch} from '@sanity/mutate'

at('body', diffMatchPatch('@@ -1,5 +1,7 @@\n hell\n+o \n o\n'))
```
