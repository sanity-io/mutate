import {createClient} from '@sanity/client'
import {CollapseIcon, ExpandIcon} from '@sanity/icons'
import {createIfNotExists, del, type Mutation, type Path} from '@sanity/mutate'
import {
  createMockBackendAPI,
  createOptimisticStore,
  createOptimisticStoreClientBackend,
  createOptimisticStoreMockBackend,
  type MutationGroup,
  type RemoteDocumentEvent,
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
import {Fragment, type ReactNode, useCallback, useEffect, useState} from 'react'
import {filter, merge, tap} from 'rxjs'
import styled from 'styled-components'
import {useThrottledCallback} from 'use-debounce'

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
import {FormatMutation} from './lib/mutate-formatter/react'
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

const sanityClient = createClient({
  projectId: import.meta.env.VITE_SANITY_API_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_API_DATASET,
  apiVersion: '2023-10-27',
  useCdn: false,
  token: import.meta.env.VITE_SANITY_API_TOKEN,
})

const USE_MOCK_BACKEND = true

const datastore = createOptimisticStore(
  USE_MOCK_BACKEND
    ? createOptimisticStoreMockBackend(createMockBackendAPI())
    : createOptimisticStoreClientBackend(sanityClient),
)
//events.subscribe(console.log)

const DOCUMENT_IDS = ['some-document', 'some-other-document']

function App() {
  const [documentId, setDocumentId] = useState<string>(DOCUMENT_IDS[0]!)
  const [documentState, setDocumentState] = useState<{
    local?: PersonDraft
    remote?: PersonDraft
  }>({})

  const [staged, setStaged] = useState<MutationGroup[]>([])
  const [autoOptimize, setAutoOptimize] = useState<boolean>(true)
  const [autoSave, setAutosave] = useState<boolean>(true)

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
      .listenEvents(documentId)
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

  const commit = useThrottledCallback(
    () => {
      // eslint-disable-next-line no-console
      datastore.submit().catch(err => console.error(err))
    },
    500,
    {trailing: true},
  )

  const handleMutate = useCallback(
    (mutations: Mutation[]) => {
      datastore.mutate(mutations)
      if (autoOptimize) datastore.optimize()
      if (autoSave) {
        commit()
      }
    },
    [autoOptimize],
  )

  const handleMutation = useCallback(
    (event: MutationEvent) => {
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
              <Stack space={4} height="fill">
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
                    <Flex
                      as="label"
                      flex={1}
                      gap={2}
                      align="center"
                      justify="center"
                    >
                      <Checkbox
                        checked={autoSave}
                        onChange={e => {
                          setAutosave(e.currentTarget.checked)
                        }}
                      />
                      <Text size={1}>Autosave</Text>
                    </Flex>
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
