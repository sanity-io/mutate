import {Box, Card, Grid} from '@sanity/ui'
import {useRef, useState} from 'react'

import {DOCUMENT_IDS} from '../shared/constants'
import {useVisualEditingDocumentSnapshot} from './context'
import EditableShoeComponent from './EditableShoe'
import PreviewShoeComponent from './PreviewShoe'

export default function App() {
  const [editing, setEditing] = useState(DOCUMENT_IDS[0]!)
  const scrollRef = useRef(0)

  return (
    <>
      <Box
        style={{height: '144px', overflowX: 'scroll'}}
        onScroll={e => {
          scrollRef.current = e.currentTarget.scrollLeft / 320
        }}
      >
        <Grid
          style={{gridAutoFlow: 'column dense', width: 'max-content'}}
          height="fill"
          gap={3}
        >
          {DOCUMENT_IDS.map((id, index) => (
            <PreviewShoe
              key={id}
              documentId={id}
              selected={id === editing}
              setEditing={setEditing}
              scrollRef={scrollRef}
              index={index}
            />
          ))}
        </Grid>
      </Box>
      <EditableShoe documentId={editing} />
    </>
  )
}

function EditableShoe(props: {documentId: string}) {
  const {documentId} = props
  const snapshot = useVisualEditingDocumentSnapshot(documentId)

  return (
    <EditableShoeComponent
      documentId={snapshot?._id}
      title={snapshot?.name}
      model={snapshot?.model || {}}
    />
  )
}

function PreviewShoe(props: {
  documentId: string
  selected: boolean
  setEditing: React.Dispatch<React.SetStateAction<string>>
  scrollRef: React.MutableRefObject<number>
  index: number
}) {
  const {documentId, selected, setEditing, scrollRef, index} = props

  const snapshot = useVisualEditingDocumentSnapshot(documentId) || ({} as any)
  const {name, model} = snapshot

  return (
    <Card
      __unstable_focusRing
      as="button"
      style={{
        aspectRatio: '1 / 1',
        position: 'relative',
        boxSizing: 'content-box',
        boxShadow: selected
          ? 'inset 0 0 0 2px var(--card-avatar-blue-bg-color),inset 0 0 0 1px var(--card-border-color)'
          : undefined,
      }}
      height="fill"
      tone={selected ? 'primary' : 'transparent'}
      radius={3}
      onClick={() => setEditing(documentId)}
      border={true}
    >
      <PreviewShoeComponent
        title={model ? name : 'Loading…'}
        model={model || {}}
        scrollRef={scrollRef}
        offsetLeft={index * 1.1}
      />
    </Card>
  )
}
