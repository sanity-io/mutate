/**
 * The logic here is intended to live inside a preview iframe, and listen to events from the parent frame.
 * It also supports running in a "detached" mode, where it has to setup authenticated EventSource conenctions and perform data fetching itself.
 */

import {type SanityDocumentBase} from '@sanity/mutate'
import {type ActorRefFrom, assertEvent, assign, setup, stopChild} from 'xstate'

import {type LocalDocumentMachine} from './local-document-machine'

export function defineVisualEditingMachine<
  const DocumentType extends SanityDocumentBase = SanityDocumentBase,
>({
  localDocumentMachine,
}: {
  localDocumentMachine: LocalDocumentMachine<DocumentType>
}) {
  type LocalDocumentActorRef = ActorRefFrom<typeof localDocumentMachine>

  return setup({
    types: {} as {
      context: {
        documents: Record<string, LocalDocumentActorRef | null>
      }
      events:
        | {type: 'listen'; documentId: string}
        | {type: 'unlisten'; documentId: string}
        | {type: 'add document actor'; documentId: string}
        | {type: 'stop document actor'; documentId: string}
        | {type: 'remove document actor from context'; documentId: string}
    },
    actions: {
      'add document actor': assign({
        documents: ({context, event, spawn}) => {
          assertEvent(event, 'listen')
          // Adding the same documentId multiple times is a no-op
          if (context.documents[event.documentId]) return context.documents
          return {
            ...context.documents,
            [event.documentId]: spawn('localDocumentMachine', {
              input: {documentId: event.documentId},
              id: event.documentId,
            }),
          }
        },
      }),
      'stop remote snapshot': stopChild(({context, event}) => {
        assertEvent(event, 'unlisten')
        return context.documents[event.documentId]!
      }),
      'remove remote snapshot from context': assign({
        documents: ({context, event}) => {
          assertEvent(event, 'unlisten')
          // Removing a non-existing documentId is a no-op
          if (!context.documents[event.documentId]) return context.documents
          return {...context.documents, [event.documentId]: null}
        },
      }),
    },
    actors: {
      localDocumentMachine,
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QBsD2BjAhsgIhgrgLZgB2ALgMTICWsZpA2gAwC6ioADqrNWdaiXYgAHogC0ADgBMAOgkA2ACyKArBICcTdfKXSANCACeiFQHYZpgMxWV800yYqp6gIyn5AXw8G0WXAWJyCnwSGjpGViEuHj4BIVEEKUt5OSlFU1smFwkFW0sDY0T1GRUXRXkXKVN7HSYJJkUvHwxsPHQiUjIZDgAnWj4SMApCfDJMemY2JBBo3n5BaYSXeVlbKRUsiXdFSxcXfKNERSqZTbr1zVMJNyaQX1aAzpkIah6yQwp0VEJCXkmo7hzOKLRDLFwyFxaSzXKTOKQudSKCQFRDOczqCSWJjwjbHCQqRFebwgEioCBwIT3fztQJkAExebxcQuFEIZaWGRIrF7dSXKTyFSNYlUtodcjdPp0aiDelAhagBLpVmWAmc46mNwSZTyLQuFS3EWPcUvN6FTiA2LykSoq6c6wbCqVUzparKioyRFVfkq1zqNSWIkeIA */
    id: 'visual-editor',
    context: () => ({
      documents: {},
    }),

    on: {
      listen: {
        actions: ['add document actor'],
      },

      unlisten: {
        actions: [
          'stop remote snapshot',
          'remove remote snapshot from context',
        ],
      },
    },

    initial: 'success',

    states: {
      success: {},
    },
  })
}
