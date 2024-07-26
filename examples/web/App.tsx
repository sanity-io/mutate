import {
  createIfNotExists,
  del,
  type Mutation,
  type Path,
  type SanityDocumentBase,
  SanityEncoder,
} from '@bjoerge/mutiny'
import {
  createContentLakeStore,
  type ListenerSyncEvent,
  type MutationGroup,
  type RemoteDocumentEvent,
  type SanityMutation,
} from '@bjoerge/mutiny/_unstable_store'
import {
  createClient,
  type MutationEvent as ClientMutationEvent,
  type ReconnectEvent,
  type SanityClient,
  type WelcomeEvent,
} from '@sanity/client'
import {CollapseIcon, ExpandIcon} from '@sanity/icons'
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
import {Fragment, type ReactNode, useCallback, useEffect, useState} from 'react'
import {
  concatMap,
  defer,
  filter,
  from,
  map,
  merge,
  of,
  share,
  shareReplay,
  tap,
  timer,
} from 'rxjs'
import styled from 'styled-components'

import {DocumentView} from './DocumentView'
import {personForm} from './forms/person'
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
import {PrimitiveUnionInput} from './lib/form/inputs/PrimitiveUnionInput'
import {JsonView} from './lib/json-view/JsonView'
import {FormatMutation} from './lib/mutiny-formatter/react'
import {person} from './schema/person'

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

const personDraft = draft(person)
type PersonDraft = Infer<typeof personDraft>

interface SharedListenerOptions {
  shutdownDelay?: number
  includeMutations?: boolean
}

function createSharedListener(
  client: SanityClient,
  options: SharedListenerOptions = {},
) {
  const {shutdownDelay, includeMutations} = options
  const allEvents$ = client
    .listen(
      '*[!(_id in path("_.**"))]',
      {},
      {
        events: ['welcome', 'mutation', 'reconnect'],
        includeResult: false,
        includePreviousRevision: false,
        visibility: 'transaction',
        effectFormat: 'mendoza',
        ...(includeMutations ? {} : {includeMutations: false}),
      },
    )
    .pipe(
      share({
        resetOnRefCountZero: shutdownDelay ? () => timer(shutdownDelay) : true,
      }),
    )

  // Reconnect events emitted in case the connection is lost
  const reconnect = allEvents$.pipe(
    filter((event): event is ReconnectEvent => event.type === 'reconnect'),
  )

  // Welcome events are emitted when the listener is (re)connected
  const welcome = allEvents$.pipe(
    filter((event): event is WelcomeEvent => event.type === 'welcome'),
  )

  // Mutation events coming from the listener
  const mutations = allEvents$.pipe(
    filter((event): event is ClientMutationEvent => event.type === 'mutation'),
  )

  // Replay the latest connection event that was emitted either when the connection was disconnected ('reconnect'), established or re-established ('welcome')
  const connectionEvent = merge(welcome, reconnect).pipe(
    shareReplay({bufferSize: 1, refCount: true}),
  )

  // Emit the welcome event if the latest connection event was the 'welcome' event.
  // Downstream subscribers will typically map the welcome event to an initial fetch
  const replayWelcome = connectionEvent.pipe(
    filter(latestConnectionEvent => latestConnectionEvent.type === 'welcome'),
  )

  // Combine into a single stream
  return merge(replayWelcome, mutations, reconnect)
}

const sanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_API_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_API_DATASET,
  apiVersion: '2023-10-27',
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
              effects: event.effects!.apply,
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

const DOCUMENT_IDS = ['some-document', 'some-other-document']

function App() {
  const [documentId, setDocumentId] = useState<string>(DOCUMENT_IDS[0]!)
  const [documentState, setDocumentState] = useState<{
    local?: PersonDraft
    remote?: PersonDraft
  }>({})

  const [staged, setStaged] = useState<MutationGroup[]>([])
  const [autoOptimize, setAutoOptimize] = useState<boolean>(true)

  const [remoteLogEntries, setRemoteLogEntries] = useState<
    RemoteDocumentEvent[]
  >([])

  useEffect(() => {
    const staged$ = datastore.meta.stage.pipe(tap(next => setStaged(next)))
    const remote$ = datastore.meta.events.pipe(
      filter(
        (ev): ev is RemoteDocumentEvent =>
          ev.type === 'sync' || ev.type === 'mutation',
      ),
      tap(event => setRemoteLogEntries(e => [...e, event].slice(0, 100))),
    )
    const sub = merge(staged$, remote$).subscribe()
    return () => sub.unsubscribe()
  }, [])
  useEffect(() => {
    const sub = datastore
      .observeEvents(documentId)
      .pipe(
        tap(event => {
          setDocumentState(current => {
            return (
              event.type === 'optimistic'
                ? {...current, local: event.after}
                : event.after
            ) as {remote: PersonDraft; local: PersonDraft}
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

  const handleMutation = useCallback(
    (event: MutationEvent) => {
      createIfNotExists({_id: documentId, _type: person.shape._type.value}),
        handleMutate([
          createIfNotExists({_id: documentId, _type: person.shape._type.value}),
          ...event.mutations,
        ])
    },
    [documentId, handleMutate],
  )
  const [attention, setAttention] = useState<{id: string; path: Path}>({
    id: documentId,
    path: [],
  })

  const handleDelete = useCallback(() => {
    handleMutate([del(documentId)])
  }, [handleMutate, documentId])
  return (
    <Card width="fill" height="fill" padding={2}>
      <Stack space={3}>
        <Stack space={3}>
          <Flex size={2} gap={2}>
            <Card flex={2} width={3} padding={3} shadow={2} radius={2}>
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
                {attention.id === documentId && attention.path.length > 0 ? (
                  <Flex padding={2} gap={2}>
                    <Text>
                      <Button
                        mode="bleed"
                        onClick={() => {
                          setAttention({id: documentId, path: []})
                        }}
                        text="/"
                      ></Button>

                      {attention.path.map((segment, i, arr) => {
                        const upToHere = arr.slice(0, i + 1)
                        return (
                          <Button
                            mode="bleed"
                            onClick={() => {
                              setAttention({id: documentId, path: upToHere})
                            }}
                            text={String(segment)}
                          ></Button>
                        )
                      })}
                    </Text>
                  </Flex>
                ) : (
                  <></>
                )}
                {DOCUMENT_IDS.map(id => (
                  <TabPanel
                    key={id}
                    aria-labelledby={`tab-${id}-panel`}
                    hidden={id !== documentId}
                    id={`tab-${id}-panel`}
                  >
                    <Card padding={3} shadow={1} radius={2}>
                      <Stack flex={1} space={3}>
                        <FormNode
                          path={
                            attention.id === documentId ? attention.path : []
                          }
                          value={
                            documentState.local || {
                              _id: documentId,
                              _type: person.shape._type.value,
                            }
                          }
                          schema={personDraft}
                          form={personForm}
                          onMutation={handleMutation}
                          renderInput={inputProps => {
                            const hasAttention =
                              attention.path === inputProps.path

                            const attentionButton = !isStringInputProps(
                              inputProps,
                            ) ? null : (
                              <Button
                                onClick={() => {
                                  setAttention(ap => {
                                    return {
                                      id: documentId,
                                      path:
                                        ap.path === inputProps.path
                                          ? []
                                          : inputProps.path,
                                    }
                                  })
                                }}
                                mode="bleed"
                                selected={hasAttention}
                                icon={hasAttention ? CollapseIcon : ExpandIcon}
                              />
                            )
                            return (
                              <Stack space={1}>
                                <Flex>
                                  <Box flex={1}>{renderInput(inputProps)}</Box>

                                  <Box>
                                    {attentionButton ? (
                                      <Flex justify="flex-end">
                                        {attentionButton}
                                      </Flex>
                                    ) : null}
                                  </Box>
                                </Flex>
                              </Stack>
                            )
                          }}
                        />
                        <Flex justify="flex-end" align="flex-end" gap={2}>
                          <Button
                            onClick={() => handleDelete()}
                            text="Delete"
                            tone="critical"
                          />
                        </Flex>
                      </Stack>
                    </Card>
                  </TabPanel>
                ))}
              </Stack>
            </Card>
            <Box flex={2}>
              <DocumentView
                local={documentState.local}
                remote={documentState.remote}
              />
            </Box>
          </Flex>
          <Flex size={2} gap={2}>
            <Card flex={1} shadow={2} radius={2} height="fill" overflow="auto">
              <Stack space={4} padding={4} height="fill">
                <Flex align="center" justify="center">
                  <Box flex={1}>
                    <Heading size={1} textOverflow="ellipsis">
                      Staged mutations
                    </Heading>
                  </Box>
                  <Flex gap={3} align="center" justify="center">
                    <Flex
                      as="label"
                      flex={1}
                      gap={2}
                      align="center"
                      justify="center"
                    >
                      <Checkbox
                        checked={autoOptimize}
                        onChange={e => {
                          setAutoOptimize(e.currentTarget.checked)
                        }}
                      />
                      <Text size={1}>Auto optimize</Text>
                    </Flex>
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
                <ScrollBack
                  space={5}
                  height="fill"
                  overflow="auto"
                  style={{height: 200}}
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
                  <div className="end" />
                </ScrollBack>
              </Stack>
            </Card>
            <Card flex={1} shadow={2} radius={2} height="fill">
              <Stack space={4} padding={4} height="fill">
                <Heading size={1}>Remote patches</Heading>
                <ScrollBack space={4} style={{height: 200}}>
                  <Grid
                    gap={3}
                    columns={3}
                    style={{gridTemplateColumns: '1fr 2fr 5fr'}}
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
                              value={
                                e.type === 'sync' ? e.after.remote : e.effects
                              }
                            />
                          </Text>
                        </Card>
                      </Fragment>
                    ))}
                  </Grid>
                  <div className="end" />
                </ScrollBack>
              </Stack>
            </Card>
          </Flex>
        </Stack>
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
  }
`
export default App
