# Optimistic store

The optimistic store is an in-memory dataset replica. Mutations apply to the replica immediately, get submitted to the Sanity Content Lake in the background, and are rebased on top of remote events as they arrive.

> [!NOTE]
> The store API is experimental. Expect changes.

## Create a store

The store needs a backend. For production, use the Sanity client backend; for tests, use the [in-memory backend](#testing-with-the-in-memory-backend).

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'

const client = createClient({
  projectId: '<projectId>',
  dataset: '<dataset>',
  apiVersion: '2026-05-12',
  useCdn: false,
})

const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
```

## Listen to a document

`listen(id)` returns an `Observable<SanityDocumentBase | undefined>` that emits the current snapshot every time it changes, including local edits that haven't been submitted yet.

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'

const client = createClient({projectId: 'x', dataset: 'y', apiVersion: '2026-05-12', useCdn: false})
const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
// ---cut---
const subscription = store.listen('author-1').subscribe((doc) => {
  console.log('snapshot', doc)
})
```

The subscription also keeps the rebase pipeline alive for that document. Without an active subscriber, `mutate()` and `submit()` silently drop their work — keep at least one subscription open for every document you read or write.

## Stage an optimistic mutation

`mutate(mutations)` applies mutations to the local replica immediately, and active `listen` subscribers receive the new snapshot. The mutations are staged — they will be sent to the Content Lake on the next `submit()`.

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'
import {at, patch, set} from '@sanity/mutate'

const client = createClient({projectId: 'x', dataset: 'y', apiVersion: '2026-05-12', useCdn: false})
const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
const subscription = store.listen('author-1').subscribe(() => {})
// ---cut---
store.mutate([patch('author-1', [at('name', set('Jane'))])])
```

Use `transaction()` to stage mutations that must land in a single Content Lake transaction:

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'
import {at, patch, set} from '@sanity/mutate'

const client = createClient({projectId: 'x', dataset: 'y', apiVersion: '2026-05-12', useCdn: false})
const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
const subscription = store.listen('author-1').subscribe(() => {})
// ---cut---
store.transaction([
  patch('author-1', [at('name', set('Jane'))]),
  patch('author-2', [at('name', set('John'))]),
])
```

## Submit staged mutations

`submit()` sends staged mutations to the Content Lake. If remote events arrive while a submit is in flight, staged mutations are rebased on top of the new remote state.

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'
import {at, patch, set} from '@sanity/mutate'

const client = createClient({projectId: 'x', dataset: 'y', apiVersion: '2026-05-12', useCdn: false})
const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
const subscription = store.listen('author-1').subscribe(() => {})
// ---cut---
store.mutate([patch('author-1', [at('name', set('Jane'))])])
store.submit()
```

Debounce `submit()` to batch bursts of keystrokes into a single request.

## Tear down

Unsubscribe when you're done with a document. The store releases the rebase pipeline for that id and frees its in-memory snapshot.

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'

const client = createClient({projectId: 'x', dataset: 'y', apiVersion: '2026-05-12', useCdn: false})
const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
const subscription = store.listen('author-1').subscribe(() => {})
// ---cut---
subscription.unsubscribe()
```

Staged mutations that haven't been submitted yet are dropped.

## Inspecting rebase events

`listenEvents(id)` emits optimistic events, remote sync events, and remote mutations along with their rebased stage. Use it to inspect rebase behaviour. It does not activate the submit pipeline, so pair it with a `listen(id)` subscription.

```ts twoslash
import {createClient} from '@sanity/client'
import {
  createOptimisticStore,
  createOptimisticStoreClientBackend,
} from '@sanity/mutate/_unstable_store'

const client = createClient({projectId: 'x', dataset: 'y', apiVersion: '2026-05-12', useCdn: false})
const backend = createOptimisticStoreClientBackend(client)
const store = createOptimisticStore(backend)
// ---cut---
store.listen('author-1').subscribe(() => {})
store.listenEvents('author-1').subscribe((event) => {
  console.log(event.type, event)
})
```

## Testing with the in-memory backend

Use `createOptimisticStoreInMemoryBackend()` in place of the client backend in unit tests:

```ts twoslash
import {
  createOptimisticStore,
  createOptimisticStoreInMemoryBackend,
} from '@sanity/mutate/_unstable_store'

const backend = createOptimisticStoreInMemoryBackend()
const store = createOptimisticStore(backend)
```
