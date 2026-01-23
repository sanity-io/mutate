import {type SanityDocument} from '@sanity/client'
import {type SanityDocumentBase} from '@sanity/mutate'
import {assign, setup} from 'xstate'

import {type RemoteDocumentMachine} from './remote-document-machine'

/**
 * This machine handles the tricky implementation details of applying patches optimistically,
 * optimizing patches to create smaller deltas and payloads, and such.
 */
export function defineLocalDocumentMachine<
  const DocumentType extends SanityDocumentBase = SanityDocumentBase,
>({
  remoteDocumentMachine,
}: {
  remoteDocumentMachine: RemoteDocumentMachine<DocumentType>
}) {
  return setup({
    types: {} as {
      children: {
        remoteDocumentMachine: 'remoteDocumentMachine'
      }
      context: {
        documentId: string
        localSnapshot: SanityDocument<DocumentType> | null
        remoteSnapshot: SanityDocument<DocumentType> | null
      }
      events: {type: 'mutate'} | {type: 'commit'}
      input: {
        documentId: string
      }
    },
    actors: {
      remoteDocumentMachine,
    },
  }).createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QBsD2BjAhsgIhgrgLZgB2ALgMTICWsZpA2gAwC6ioADqrNWdaiXYgAHogC0ADgBMAOgkA2ACyKArBICcTdfKXSANCACeiFQHYZpgMxWV800yYqp6gIyn5AXw8G0WXAWJyCnwSGjpGViEuHj4BIVEEKUt5OSlFU1smFwkFW0sDY0T1GRUXRXkXKVN7HSYJJkUvHwxsPHQiUjIZDgAnWj4SMApCfDJMemY2JBBo3n5BaYSXeVlbKRUsiXdFSxcXfKNERSqZTbr1zVMJNyaQX1aAzpkIah6yQwp0VEJCXkmo7hzOKLRDLFwyFxaSzXKTOKQudSKCQFRDOczqCSWJjwjbHCQqRFebwgEioCBwIT3fztQJkAExebxcQuFEIZaWGRIrF7dSXKTyFSNYlUtodcjdPp0aiDelAhagBLpVmWAmc46mNwSZTyLQuFS3EWPcUvN6FTiA2LykSoq6c6wbCqVUzparKioyRFVfkq1zqNSWIkeIA */
    id: 'localDocument',
    context: ({input}) => ({
      documentId: input.documentId,
      localSnapshot: null,
      remoteSnapshot: null,
    }),

    invoke: {
      src: 'remoteDocumentMachine',
      id: 'remoteDocumentMachine',
      input: ({context}) => ({documentId: context.documentId}),
      onSnapshot: {
        actions: assign({
          remoteSnapshot: ({event}) => event.snapshot.context.snapshot,
        }),
      },
    },

    initial: 'pristine',

    states: {
      pristine: {
        on: {
          mutate: 'dirty',
        },
      },

      dirty: {
        on: {
          commit: 'pristine',
        },
      },
    },
  })
}

export type LocalDocumentMachine<
  DocumentType extends SanityDocumentBase = SanityDocumentBase,
> = ReturnType<typeof defineLocalDocumentMachine<DocumentType>>
