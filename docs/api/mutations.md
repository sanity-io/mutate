# Mutations

Top-level mutation creators from `@sanity/mutate`.

## `create(document)`

Create a new document. The server assigns the id if `_id` is omitted.

```ts twoslash
import {create} from '@sanity/mutate'

const mutation = create({_type: 'dog', name: 'Fido'})
```

## `createIfNotExists(document)`

Create a document only if no document with the given `_id` exists.

```ts twoslash
import {createIfNotExists} from '@sanity/mutate'

const mutation = createIfNotExists({
  _id: 'author-1',
  _type: 'author',
  name: 'Jane',
})
```

## `createOrReplace(document)`

Create a new document, or fully replace the existing one with the given `_id`.

```ts twoslash
import {createOrReplace} from '@sanity/mutate'

const mutation = createOrReplace({
  _id: 'author-1',
  _type: 'author',
  name: 'Jane',
})
```

## `delete_(documentId)`

Delete a document by id. Aliases: `del`, `destroy`.

```ts twoslash
import {del} from '@sanity/mutate'

const mutation = del('author-1')
```

## `patch(documentId, patches, options?)`

Apply one or more patches to a document. Pass `{ifRevision}` for [optimistic locking](https://www.sanity.io/docs/http-mutations#26600a871378) — the mutation fails if the document's current `_rev` doesn't match.

```ts twoslash
import {at, patch, set} from '@sanity/mutate'

const patches = [at('name', set('Jane'))]
const mutation = patch('author-1', patches, {ifRevision: 'abc123'})
```
