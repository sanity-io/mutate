import {type SanityDocumentBase} from '@bjoerge/mutiny'
import {
  Card,
  Flex,
  Heading,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Text,
} from '@sanity/ui'
import {useState} from 'react'

import {JsonView} from './lib/json-view/JsonView'

interface DocumentViewProps<Doc extends SanityDocumentBase> {
  local: Doc | undefined
  remote: Doc | undefined
}

const TABS = [{id: 'current', title: 'Current document'}] as const

export function DocumentView<Doc extends SanityDocumentBase>(
  props: DocumentViewProps<Doc>,
) {
  const {local, remote} = props
  const [tabId, setTab] = useState<(typeof TABS)[number]['id']>(TABS[0].id)
  const tabs = {
    current: () => (
      <Flex gap={2}>
        {local && (
          <Card flex={1} padding={4} shadow={2} radius={2} overflow="auto">
            <Stack space={4}>
              <Heading size={1}>Local</Heading>
              <Text size={1}>
                <JsonView value={local} />
              </Text>
            </Stack>
          </Card>
        )}
        {remote && (
          <Card flex={1} padding={4} shadow={2} radius={2} overflow="auto">
            <Stack space={4}>
              <Heading size={1}>Remote</Heading>
              <Text size={1}>
                <JsonView value={remote} />
              </Text>
            </Stack>
          </Card>
        )}
      </Flex>
    ),
  }
  return (
    <Stack padding={2} margin={2}>
      <TabList space={2} margin={2} padding={2}>
        {TABS.map(tab => (
          <Tab
            key={tab.id}
            aria-controls={`tab-${tab.id}-panel`}
            id={`tab-${tab.id}`}
            label={tab.title}
            onClick={() => {
              setTab(tab.id)
            }}
            selected={tab.id === tabId}
          />
        ))}
      </TabList>
      {TABS.map(tab => (
        <TabPanel
          key={tab.id}
          aria-labelledby={`tab-${tab.id}-panel`}
          hidden={tab.id !== tabId}
          id={`tab-${tab.id}-panel`}
        >
          <Stack flex={1} space={3}>
            {tabs[tab.id]()}
          </Stack>
        </TabPanel>
      ))}
    </Stack>
  )
}
