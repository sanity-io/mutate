import {
  type Index,
  type KeyedPathElement,
  type NodePatch,
  type Operation,
} from '@bjoerge/mutiny'
import {stringify as stringifyPath} from '@bjoerge/mutiny/path'
import {Flex, Inline, Text} from '@sanity/ui'

import {JsonView} from '../../../json-view/JsonView'

function formatReferenceItem(ref: Index | KeyedPathElement) {
  return `[_key==${typeof ref === 'number' ? ref : ref._key}]`
}

export function FormatNodePatch(props: {patch: NodePatch}) {
  const {patch} = props

  const path = stringifyPath(patch.path)

  return (
    <Flex gap={1}>
      <Inline>
        <Text size={1} muted></Text>
        <Text size={1}>{path}:</Text>
      </Inline>
      <FormatOp op={patch.op} />
    </Flex>
  )
}
function FormatOp(props: {op: Operation}) {
  const {op} = props
  if (op.type === 'unset') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {op.type}
        </Text>
        <Text size={1}>()</Text>
      </Inline>
    )
  }
  if (op.type === 'diffMatchPatch') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {op.type}
        </Text>
        <Text size={1}>({op.value})</Text>
      </Inline>
    )
  }
  if (op.type === 'inc' || op.type === 'dec') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {op.type}
        </Text>
        <Text size={1}>(${op.amount})</Text>
      </Inline>
    )
  }
  if (op.type === 'set' || op.type === 'setIfMissing') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {op.type}
        </Text>
        <Text size={1}>
          (<JsonView value={op.value} oneline />)
        </Text>
      </Inline>
    )
  }
  if (op.type === 'assign') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {op.type}
        </Text>
        <Text size={1}>
          (<JsonView value={op.value} oneline />)
        </Text>
      </Inline>
    )
  }
  if (op.type === 'unassign') {
    return (
      <Inline>
        <Text size={1} weight="semibold">
          {op.type}
        </Text>
        <Text size={1}>({op.keys.join(', ')})</Text>
      </Inline>
    )
  }
  if (op.type === 'insert' || op.type === 'upsert') {
    return (
      <>
        <Text size={1} weight="semibold">
          {op.type} {op.position}({formatReferenceItem(op.referenceItem)})
        </Text>
        <Text size={1}>
          <JsonView value={op.items} oneline />
        </Text>
      </>
    )
  }
  if (op.type === 'replace') {
    return (
      <>
        <Text size={1} weight="semibold">
          {op.type} ({formatReferenceItem(op.referenceItem)})
        </Text>
        <Text size={1}>
          <JsonView value={op.items} oneline />
        </Text>
      </>
    )
  }
  if (op.type === 'truncate') {
    return (
      <Text size={1} weight="semibold">
        {op.type} ({op.startIndex}, {op.endIndex}))
      </Text>
    )
  }
  // @ts-expect-error all cases are covered
  throw new Error(`Invalid operation type: ${op.type}`)
}
