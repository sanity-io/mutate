import {
  at,
  patch,
  type Path,
  type PathElement,
  setIfMissing,
} from '@bjoerge/mutiny'
import {
  getInstanceName,
  type Infer,
  isDocumentSchema,
  isObjectSchema,
  type ObjectFormDef,
  type SanityDocument,
  type SanityFormDef,
  type SanityType,
} from '@sanity/sanitype'
import {useCallback, useMemo} from 'react'

import {type DocumentInputProps, type PatchEvent} from './types'

type FormNodeProps<Schema extends SanityDocument> =
  DocumentInputProps<Schema> & {
    path: Path
  }

type Node = {
  type: 'field'
  pathElement: PathElement
  schema: SanityType
  form: SanityFormDef<any>
  value: any
}

function resolveNode<Schema extends SanityType>(
  path: PathElement[] | readonly PathElement[],
  schema: Schema,
  value: Infer<Schema>,
  form: SanityFormDef<Schema>,
): Node[] {
  if (path.length === 0) {
    return []
  }

  if (isObjectSchema(schema) || isDocumentSchema(schema)) {
    const [fieldName, ...rest] = path
    if (typeof fieldName !== 'string') {
      throw new Error('Expected field name')
    }
    const fieldType = schema.shape[fieldName]
    if (!fieldType) {
      throw new Error(`Form definition for field "${fieldName}" not found`)
    }
    const fieldValue = value?.[fieldName]
    const fieldForm = (form as ObjectFormDef<any>).fields[fieldName]?.form
    return [
      {
        type: 'field',
        pathElement: fieldName,
        schema: fieldType,
        value: fieldValue,
        form: fieldForm,
      },
      ...resolveNode(rest, fieldType, fieldValue, fieldForm),
    ]
  }

  return []
}

export function FormNode<Schema extends SanityDocument>(
  props: FormNodeProps<Schema>,
) {
  const {resolveInput, path, schema, value, onMutation, form} = props

  if (path.length === 0) {
    throw new Error('The FormNode component requires a non-empty path')
  }

  const nodes = useMemo(() => {
    return resolveNode(path, schema, value, form)
  }, [form, path, schema, value])

  const last = nodes.at(-1)!

  const Input = resolveInput(last.schema)
  const handlePatch = useCallback(
    (patchEvent: PatchEvent) => {
      const patches = nodes.reduceRight((prev, node) => {
        const instanceName = getInstanceName(schema)
        return [
          at([], setIfMissing(instanceName ? {_type: instanceName} : {})),
          ...prev.map(nodePatch =>
            at([node.pathElement, ...nodePatch.path], nodePatch.op),
          ),
        ]
      }, patchEvent.patches)
      onMutation({
        mutations: patches.map(nodePatch => patch(value._id, nodePatch)),
      })
    },
    [nodes, onMutation, schema, value._id],
  )

  return (
    <Input
      schema={last.schema}
      onPatch={handlePatch}
      value={last?.value}
      resolveInput={resolveInput}
      form={last?.form as SanityFormDef<Schema>}
    />
  )
}
