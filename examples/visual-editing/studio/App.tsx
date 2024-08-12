import {
  createClient,
  type MutationEvent as ClientMutationEvent,
  type ReconnectEvent,
  type WelcomeEvent,
} from '@sanity/client'
import {
  createIfNotExists,
  del,
  type Mutation,
  type SanityDocumentBase,
  SanityEncoder,
} from '@sanity/mutate'
import {
  createSharedListener,
  type documentMutatorMachine,
  type DocumentMutatorMachineParentEvent,
} from '@sanity/mutate/_unstable_machine'
import {
  createContentLakeStore,
  type ListenerSyncEvent,
  type MutationGroup,
  type RemoteDocumentEvent,
  type SanityMutation,
} from '@sanity/mutate/_unstable_store'
import {
  draft,
  type Infer,
  isBooleanSchema,
  isDocumentSchema,
  isObjectSchema,
  isObjectUnionSchema,
  isOptionalSchema,
  isPrimitiveUnionSchema,
  isStringSchema,
  type SanityAny,
  type SanityBoolean,
  type SanityObject,
  type SanityObjectUnion,
  type SanityOptional,
  type SanityPrimitiveUnion,
  type SanityString,
} from '@sanity/sanitype'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Text,
} from '@sanity/ui'
import {useActorRef, useSelector} from '@xstate/react'
import {type RawPatch} from 'mendoza'
import {
  Fragment,
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
} from 'react'
import {concatMap, defer, filter, from, map, merge, of, tap} from 'rxjs'
import styled from 'styled-components'
import {type ActorRefFrom} from 'xstate'

import {DOCUMENT_IDS} from '../shared/constants'
import {DocumentView} from '../shared/DocumentView'
import {JsonView} from '../shared/json-view/JsonView'
import {datasetMutatorMachine} from './datasetMutatorMachine'
import {shoeForm} from './forms/shoe'
import {
  BooleanInput,
  DocumentInput,
  type DocumentInputProps,
  type InputProps,
  type MutationEvent,
  ObjectInput,
  StringInput,
  UnionInput,
} from './lib/form'
import {FormNode} from './lib/form/FormNode'
import {ColorInput} from './lib/form/inputs/ColorInput'
import {PrimitiveUnionInput} from './lib/form/inputs/PrimitiveUnionInput'
import {FormatMutation} from './lib/mutate-formatter/react'
import {shoe} from './schema/shoe'
import {type InspectType} from './types'

function Unresolved<Schema extends SanityAny>(props: InputProps<Schema>) {
  return <Text>Unresolved input for type {props.schema.typeName}</Text>
}

function OptionalInput<Schema extends SanityOptional<SanityAny>>(
  props: InputProps<Schema>,
) {
  return props.renderInput({
    ...props,
    schema: props.schema.type,
  })
}

function isColorInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityString> {
  return (
    isStringInputProps(props) &&
    // @ts-expect-error this is fine
    props.form?.color
  )
}
function isStringInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityString> {
  return isStringSchema(props.schema)
}

function isOptionalInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityOptional<SanityAny>> {
  return isOptionalSchema(props.schema)
}

function isObjectInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityObject> {
  return isObjectSchema(props.schema)
}

function isDocumentInputProps(
  props: InputProps<SanityAny> | DocumentInputProps,
): props is DocumentInputProps {
  return isDocumentSchema(props.schema)
}

function isObjectUnionInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityObjectUnion> {
  return isObjectUnionSchema(props.schema)
}
function isPrimitiveUnionInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityPrimitiveUnion> {
  return isPrimitiveUnionSchema(props.schema)
}
function isBooleanInputProps(
  props: InputProps<SanityAny>,
): props is InputProps<SanityBoolean> {
  return isBooleanSchema(props.schema)
}

function renderInput<Props extends InputProps<SanityAny>>(
  props: Props,
): ReactNode {
  if (isColorInputProps(props)) {
    return <ColorInput {...props} />
  }
  if (isStringInputProps(props)) {
    return <StringInput {...props} />
  }
  if (isOptionalInputProps(props)) {
    return <OptionalInput {...props} />
  }
  if (isObjectInputProps(props)) {
    return <ObjectInput {...props} />
  }
  if (isDocumentInputProps(props)) {
    return <DocumentInput {...props} />
  }
  if (isObjectUnionInputProps(props)) {
    return <UnionInput {...props} />
  }
  if (isPrimitiveUnionInputProps(props)) {
    return <PrimitiveUnionInput {...props} />
  }
  if (isBooleanInputProps(props)) {
    return <BooleanInput {...props} />
  }
  return <Unresolved {...props} />
}

const shoeDraft = draft(shoe)
type ShoeDraft = Infer<typeof shoeDraft>

const sanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_API_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_API_DATASET,
  apiVersion: '2024-02-28',
  useCdn: false,
  token: import.meta.env.VITE_SANITY_API_TOKEN,
})

const listener = createSharedListener(sanityClient)

const RECONNECT_EVENT: ReconnectEvent = {type: 'reconnect'}

function observe(documentId: string) {
  return defer(() => listener).pipe(
    filter(
      (event): event is WelcomeEvent | ClientMutationEvent | ReconnectEvent =>
        event.type === 'welcome' ||
        event.type === 'reconnect' ||
        (event.type === 'mutation' && event.documentId === documentId),
    ),
    concatMap(event =>
      event.type === 'reconnect'
        ? of(RECONNECT_EVENT)
        : event.type === 'welcome'
          ? sanityClient.observable.getDocument(documentId).pipe(
              map(
                (doc: undefined | SanityDocumentBase): ListenerSyncEvent => ({
                  type: 'sync',
                  transactionId: doc?._id,
                  document: doc,
                }),
              ),
            )
          : of({
              type: 'mutation' as const,
              transactionId: event.transactionId,
              effects: event.effects as {apply: RawPatch},
              previousRev: event.previousRev!,
              resultRev: event.resultRev!,
              mutations: event.mutations as SanityMutation[],
            }),
    ),
  )
}

const datastore = createContentLakeStore({
  observe,
  submit: transactions => {
    return from(transactions).pipe(
      concatMap(transaction =>
        sanityClient.dataRequest(
          'mutate',
          SanityEncoder.encodeTransaction(transaction),
          {visibility: 'async', returnDocuments: false},
        ),
      ),
    )
  },
})

function App(props: {inspect: InspectType}) {
  const {inspect} = props
  const datasetMutatorActorRef = useActorRef(datasetMutatorMachine, {
    input: {client: sanityClient, sharedListener: listener},
    inspect,
  })

  // Open the observed ids on startup
  useEffect(() => {
    for (const id of DOCUMENT_IDS) {
      datasetMutatorActorRef.send({type: 'observe', documentId: id})
    }
    return () => {
      for (const id of DOCUMENT_IDS) {
        datasetMutatorActorRef.send({type: 'unobserve', documentId: id})
      }
    }
  }, [datasetMutatorActorRef])

  const [documentId, setDocumentId] = useState(DOCUMENT_IDS[0]!)
  const [documentState, setDocumentState] = useState<{
    local?: ShoeDraft
    remote?: ShoeDraft
  }>({})

  const [staged, setStaged] = useState<MutationGroup[]>([])
  const [autoOptimize, setAutoOptimize] = useState<boolean>(true)

  const [remoteLogEntries, setRemoteLogEntries] = useState<
    DocumentMutatorMachineParentEvent[]
  >([])

  useEffect(() => {
    const sub = datasetMutatorActorRef.on('*', event => {
      switch (event.type) {
        case 'mutation':
        case 'sync':
          return setRemoteLogEntries(e => [...e, event].slice(0, 100))
      }
    })
    return () => sub.unsubscribe()
  }, [datasetMutatorActorRef])
  useEffect(() => {
    const staged$ = datastore.meta.stage.pipe(tap(next => setStaged(next)))
    const sub = staged$.subscribe()
    return () => sub.unsubscribe()
  }, [])
  useEffect(() => {
    if (!documentId) return
    const sub = datastore
      .observeEvents(documentId)
      .pipe(
        tap(event => {
          setDocumentState(current => {
            return (
              event.type === 'optimistic'
                ? {...current, local: event.after}
                : event.after
            ) as {remote: ShoeDraft; local: ShoeDraft}
          })
        }),
      )
      .subscribe()
    return () => sub.unsubscribe()
  }, [documentId])

  const handleMutate = useCallback(
    (mutations: Mutation[]) => {
      datastore.mutate(mutations)
      if (autoOptimize) datastore.optimize()
    },
    [autoOptimize],
  )
  const deferredStaged = useDeferredValue(staged)

  return (
    <>
      <Card
        flex={2}
        width={3}
        padding={3}
        border
        radius={4}
        overflow="auto"
        tone="transparent"
        style={{gridArea: 'editor'}}
      >
        <Stack space={3}>
          <TabList space={2}>
            {DOCUMENT_IDS.map(id => (
              <Tab
                key={id}
                aria-controls={`tab-${id}-panel`}
                id={`tab-${id}`}
                label={id}
                onClick={() => {
                  setDocumentId(id)
                }}
                selected={id === documentId}
              />
            ))}
          </TabList>
          {DOCUMENT_IDS.map(id => (
            <DocumentTabPanelProvider
              key={id}
              id={id}
              hidden={id !== documentId}
              inspect={inspect}
              datasetMutatorActorRef={datasetMutatorActorRef}
            />
          ))}
        </Stack>
      </Card>
      <StagedMutations
        staged={deferredStaged}
        autoOptimize={autoOptimize}
        setAutoOptimize={setAutoOptimize}
      />
      <RemoteLogEntries remoteLogEntries={remoteLogEntries} />
    </>
  )
}

function DocumentTabPanelProvider(props: {
  id: string
  hidden: boolean
  datasetMutatorActorRef: ActorRefFrom<typeof datasetMutatorMachine>
  inspect: InspectType
}) {
  const {id, hidden, datasetMutatorActorRef} = props
  const documentRef = useSelector(
    datasetMutatorActorRef,
    state => state.context.documents[id],
  )
  const ready = useSelector(documentRef, state => state?.hasTag('ready'))

  return (
    <TabPanel
      aria-labelledby={`tab-${id}-panel`}
      id={`tab-${id}-panel`}
      hidden={hidden}
    >
      {ready ? (
        <DocumentTabPanelContent
          id={id}
          hidden={hidden}
          documentRef={documentRef!}
        />
      ) : (
        <Text>Loading...</Text>
      )}
    </TabPanel>
  )
}

function DocumentTabPanelContent(props: {
  id: string
  hidden: boolean
  documentRef: ActorRefFrom<typeof documentMutatorMachine>
}) {
  const {id, hidden, documentRef} = props
  const local = useSelector(documentRef, state => state.context.local)
  const deferredLocal = useDeferredValue(local)
  const dirty = useSelector(documentRef, state =>
    state.matches({connected: {loaded: 'dirty'}}),
  )
  const canDelete = useSelector(
    documentRef,
    state => state.hasTag('ready') && !!state.context.local,
  )
  documentRef.on('error', () => {})

  const handleMutation = (event: MutationEvent) => {
    documentRef.send({
      type: 'mutate',
      mutations: [
        createIfNotExists({_id: id, _type: shoe.shape._type.value}),
        ...event.mutations,
      ],
    })
  }
  const handleDelete = () => {
    documentRef.send({
      type: 'mutate',
      mutations: [del(id)],
    })
  }

  return (
    <Stack space={3}>
      <Card padding={3} shadow={1} radius={3}>
        <Stack flex={1} space={3}>
          <FormNode
            path={[]}
            // @ts-expect-error figure out the typings issue later
            value={
              (hidden ? deferredLocal : local) || {
                _id: id,
                _type: shoe.shape._type.value,
              }
            }
            schema={shoeDraft}
            form={shoeForm}
            onMutation={handleMutation}
            renderInput={renderInput}
          />
          <Flex justify="flex-end" align="flex-end" gap={2}>
            <Button
              onClick={handleDelete}
              text="Delete"
              tone="critical"
              disabled={!canDelete}
            />
            <Button
              onClick={() => documentRef.send({type: 'submit'})}
              text="Submit"
              tone="positive"
              disabled={!dirty}
            />
          </Flex>
        </Stack>
      </Card>
      <DocumentTabJsonView documentRef={documentRef} />
    </Stack>
  )
}

function DocumentTabJsonView(props: {
  documentRef: ActorRefFrom<typeof documentMutatorMachine>
}) {
  const {documentRef} = props

  const remote = useSelector(documentRef, state => state.context.remote)
  const deferredRemote = useDeferredValue(remote)
  const local = useSelector(documentRef, state => state.context.local)
  const deferredLocal = useDeferredValue(local)

  return (
    <Flex size={2} gap={2}>
      <Box flex={2}>
        <DocumentView
          // @ts-expect-error figure out the typings issue later
          local={deferredLocal}
          // @ts-expect-error figure out the typings issue later
          remote={deferredRemote}
        />
      </Box>
    </Flex>
  )
}

function StagedMutations(props: {
  staged: MutationGroup[]
  setAutoOptimize: React.Dispatch<React.SetStateAction<boolean>>
  autoOptimize: boolean
}) {
  const {staged, autoOptimize, setAutoOptimize} = props
  return (
    <Card
      flex={1}
      border
      radius={4}
      style={{gridArea: 'staged', position: 'relative'}}
    >
      <Stack space={4} paddingX={4} paddingTop={4} height="fill">
        <Heading size={1} textOverflow="ellipsis">
          Staged mutations
        </Heading>
        <ScrollBack
          space={5}
          height="fill"
          overflow="auto"
          style={{maxHeight: '20vh'}}
        >
          {staged.map((e, i) => (
            <Stack key={i} space={4}>
              {e.mutations.map((m, mi) => (
                <Flex key={mi} gap={3} align="center">
                  <FormatMutation mutation={m} />
                </Flex>
              ))}
            </Stack>
          ))}
          <Box className="end" paddingBottom={[4, 4, 4, 4, 0]} />
        </ScrollBack>
        <Flex
          align="center"
          justify="flex-end"
          style={{position: 'absolute', right: 0, bottom: 0}}
          marginBottom={2}
          marginRight={2}
        >
          <Flex gap={3} align="center" justify="flex-end">
            <Card tone="default" paddingX={1} paddingY={1} radius={3}>
              <Flex as="label" flex={1} gap={2} align="center" justify="center">
                <Checkbox
                  checked={autoOptimize}
                  onChange={e => {
                    setAutoOptimize(e.currentTarget.checked)
                  }}
                />
                <Text size={1}>Auto optimize</Text>
              </Flex>
            </Card>
            <Button
              onClick={() => {
                datastore.optimize()
              }}
              mode="ghost"
              text="Optimize pending"
            />
            <Button
              onClick={() => {
                datastore.submit()
              }}
              text="Submit pending"
            />
          </Flex>
        </Flex>
      </Stack>
    </Card>
  )
}

function RemoteLogEntries(props: {
  remoteLogEntries: DocumentMutatorMachineParentEvent[]
}) {
  const {remoteLogEntries} = props
  return (
    <Card flex={1} border radius={4} style={{gridArea: 'remote'}}>
      <Stack space={4} paddingX={4} paddingTop={4} height="fill">
        <Heading size={1}>Remote patches</Heading>
        <ScrollBack
          space={4}
          height="fill"
          overflow="auto"
          style={{maxHeight: '20vh'}}
        >
          {remoteLogEntries.length > 0 && (
            <Grid
              gap={3}
              columns={3}
              style={{gridTemplateColumns: 'min-content max-content 1fr'}}
            >
              {remoteLogEntries.map((e, i) => (
                <Fragment key={i}>
                  <Text size={1} muted weight="semibold">
                    {e.type}
                  </Text>
                  <Text size={1} muted>
                    <JsonView oneline value={e.id} />
                  </Text>
                  <Card flex={1}>
                    <Text size={1}>
                      <JsonView
                        oneline
                        value={e.type === 'sync' ? e.document : e.effects}
                      />
                    </Text>
                  </Card>
                </Fragment>
              ))}
            </Grid>
          )}
          <Box className="end" paddingBottom={[4, 4, 4, 4, 0]} />
        </ScrollBack>
      </Stack>
    </Card>
  )
}

const ScrollBack = styled(Stack)`
  overflow-y: scroll;
  overscroll-behavior-y: contain;
  scroll-snap-type: y proximity;
  .end {
    scroll-snap-align: end;

    &:only-child {
      padding-bottom: 0;
    }
  }
`

export default App
