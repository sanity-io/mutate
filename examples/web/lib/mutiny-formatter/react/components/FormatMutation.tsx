import {type Mutation} from '@bjoerge/mutiny'
import {Box, Flex, Inline, Stack, Text} from '@sanity/ui'

import {JsonView} from '../../../json-view/JsonView'
import {FormatNodePatch} from './FormatPatchMutation'

interface FormatMutationProps {
  mutation: Mutation
}

export function FormatMutation(props: FormatMutationProps) {
  const {mutation} = props
  if (
    mutation.type === 'create' ||
    mutation.type === 'createIfNotExists' ||
    mutation.type === 'createOrReplace'
  ) {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {mutation.type}
        </Text>
        (<JsonView value={mutation.document} oneline />)
      </Inline>
    )
  }
  if (mutation.type === 'delete') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {mutation.type}
        </Text>
        (<JsonView value={mutation.id} oneline />)
      </Inline>
    )
  }
  if (mutation.type === 'patch') {
    const ifRevision = mutation.options?.ifRevision
    return (
      <>
        <Stack space={3}>
          <Flex gap={2} align="center">
            <Inline>
              <Text size={1} weight="semibold">
                {mutation.type}
              </Text>
              (<JsonView value={mutation.id} oneline />)
            </Inline>
            {ifRevision ? (
              <Inline>
                <Text muted size={1}>
                  if revision==<code>{ifRevision}</code>
                </Text>
              </Inline>
            ) : null}
          </Flex>
          {mutation.patches.map((nodePatch, i) => (
            <Box key={i} paddingLeft={3}>
              <FormatNodePatch patch={nodePatch} />
            </Box>
          ))}
        </Stack>
      </>
    )
  }

  //@ts-expect-error - all cases are covered
  return <div>Invalid mutation type: ${mutation.type}</div>
}
