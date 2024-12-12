import {createClient} from '@sanity/client'
import {createActorContext, useSelector} from '@xstate/react'
import {useEffect} from 'react'
import {createEmptyActor} from 'xstate'

import {defineLocalDocumentMachine} from '../shared/state/local-document-machine'
import {defineRemoteDocumentMachine} from '../shared/state/remote-document-machine'
import {
  createSharedListener,
  defineGetDocument,
  defineRemoteEvents,
} from '../shared/state/remote-events-machine'
import {defineVisualEditingMachine} from '../shared/state/visual-editor-machine'

const sanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_API_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_API_DATASET,
  apiVersion: '2023-10-27',
  useCdn: false,
  token: import.meta.env.VITE_SANITY_API_TOKEN,
})

/**
 * How long the `client.listen()` EventSource is kept alive after the last subscriber unsubscribes, until it's possibly resubscribed
 */
const keepAlive = 1_000

/**
 * Dependencies for the Visual Editing machine
 */
const listener = createSharedListener(sanityClient)
const remoteEvents = defineRemoteEvents({listener, keepAlive})
const getDocument = defineGetDocument({client: sanityClient})
const remoteDocumentMachine = defineRemoteDocumentMachine({
  getDocument,
  remoteEvents,
})
const localDocumentMachine = defineLocalDocumentMachine({remoteDocumentMachine})

export const visualEditingMachine = defineVisualEditingMachine({
  localDocumentMachine,
})

export const {
  Provider: VisualEditingProvider,
  useActorRef: useVisualEditingActorRef,
  useSelector: useVisualEditingSelector,
} = createActorContext(visualEditingMachine)

// Used to handle cases where an actor isn't set yet
const emptyLocalDocumentActor = createEmptyActor()

export function useVisualEditingDocumentSnapshot(documentId: string) {
  const visualEditingActorRef = useVisualEditingActorRef()

  // Always load up whichever document a snapshot is being requested for
  useEffect(() => {
    // Due to React StrictMode, we schedule it to the next tick, and cancel it on unmount
    const raf = requestAnimationFrame(() => {
      visualEditingActorRef.send({type: 'listen', documentId})
    })
    return () => cancelAnimationFrame(raf)
  }, [documentId, visualEditingActorRef])

  // Get a ref to the local document machine
  const localDocumentActorRef = useVisualEditingSelector(
    snapshot =>
      snapshot.context.documents[documentId] || emptyLocalDocumentActor,
  )

  return useSelector(
    localDocumentActorRef,
    // @ts-expect-error figure out how to infer types correctly when using nullable actor refs
    state => state?.context?.remoteSnapshot,
  )
}
