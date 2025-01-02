import {createClient} from '@sanity/client'
import {
  createDocumentEventListener,
  createDocumentLoaderFromClient,
  createDocumentUpdateListener,
  createReadOnlyStore,
  createSharedListenerFromClient,
} from '@sanity/mutate/_unstable_store'

const client = createClient({
  /* client config */
})

// Create a document loader (data loader that will batch requests for individual documents)
const loadDocument = createDocumentLoaderFromClient(client)

const sharedListenerEvents = createSharedListenerFromClient(client, {
  // optional filter. Must match the doucment types you want to subscribe to.
  // defaults to `*`
  // filter: `_type == 'some-type'`,
})

const listenDocumentEvents = createDocumentEventListener({
  // pass a function that will load a document by id
  loadDocument,
  // this must be a stream of listener events, in our case we're using a shared listener for the document type(s) we're interested in
  listenerEvents: sharedListenerEvents,
})

const listenDocumentUpdates = createDocumentUpdateListener({
  // pass it our shared document event listener
  listenDocumentEvents,
})

// create the store
const store = createReadOnlyStore(listenDocumentUpdates)

// we can now subscribe to documents
store.listenDocument('foo').subscribe(update => {
  console.log(update.event, update.snapshot)
})

// we can now subscribe to documents
store.listenDocuments(['foo', 'bar']).subscribe(([fooUpdate, barUpdate]) => {
  // this will be called with latest foo and bar when either change
  console.log(fooUpdate.snapshot, barUpdate.snapshot)
})

// We can also use the document loader and the listeners created above independently if we want to:
listenDocumentEvents('foo').subscribe(event => {
  console.log(event.type) // logs 'reconnect', 'sync' or 'mutation'
})

// We can also subscribe to every listener event matching the filter
// this will establish an SSE connection upon first publish, share the underlying event stream between all subscribers
// and disconnect the SSE connection when the last subscriber unsubscribes
sharedListenerEvents.subscribe(event => {
  console.log(event.type) // logs 'reconnect', 'welcome' or 'mutation'
})

// Load a document by id from the /doc endpoint. Not cached, only batched and deduped dataloader style
loadDocument('bar').subscribe(result => {
  if (result.accessible) {
    console.log(result.document)
  } else {
    console.log('Document %s not accessible: %s', result.id, result.reason)
  }
})
