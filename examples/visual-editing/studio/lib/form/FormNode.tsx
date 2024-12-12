import {
  at,
  patch,
  type Path,
  type PathElement,
  setIfMissing,
} from '@sanity/mutate'
import {
  getInstanceName,
  type Infer,
  isDocumentSchema,
  isObjectSchema,
  isObjectUnionSchema,
  isOptionalSchema,
  type ObjectFormDef,
  type ObjectUnionFormDef,
  type SanityDocument,
  type SanityFormDef,
  type SanityType,
  type SanityTypedObject,
} from '@sanity/sanitype'
import {Stack, Text} from '@sanity/ui'
import {useCallback, useMemo} from 'react'

import {DocumentInput} from './inputs/objects/DocumentInput'
import {type DocumentInputProps, type PatchEvent} from './types'

type FormNodeProps<Schema extends SanityDocument> =
  DocumentInputProps<Schema> & {
    path: Path
  }

type Node = {
  type: 'field'
  pathElement: PathElement
  schema: SanityType
  form?: SanityFormDef<any>
  value: any
}

function resolveNode<Schema extends SanityType>(
  path: PathElement[] | readonly PathElement[],
  schema: Schema,
  value: Infer<Schema> | undefined,
  form?: SanityFormDef<Schema>,
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
    const fieldForm = (form as ObjectFormDef<any>)?.fields[fieldName]
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

  if (isObjectUnionSchema(schema)) {
    const type = value?._type
    const valueType = schema.union.find(ut => getInstanceName(ut) === type)!
    const typeForm = (
      (form as ObjectUnionFormDef<SanityTypedObject>).types as any
    )[type]
    return resolveNode(path, valueType, value, typeForm)
  }

  if (isOptionalSchema(schema)) {
    return resolveNode(path, schema.type, value, form)
  }

  return []
}

function FormNode_<Schema extends SanityDocument>(
  props: FormNodeProps<Schema>,
) {
  const {renderInput, path, schema, value, onMutation, form} = props

  if (path.length === 0) {
    throw new Error('The FormNode component requires a non-empty path')
  }

  const nodes = useMemo(() => {
    return resolveNode(path, schema, value, form)
  }, [form, path, schema, value])

  const last = nodes.at(-1)

  if (!last) {
    throw new Error('Expected at least one node')
  }

  if (!last.form) {
    throw new Error(`No form definition for field "${path.at(-1)}"`)
  }

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
  const input = renderInput({
    schema: last.schema as Schema,
    onPatch: handlePatch,
    value: last?.value,
    path,
    renderInput,
    form: last.form,
  })

  return (
    <Stack space={3}>
      <label>
        <Text size={1} weight="semibold">
          {last?.form?.title}
        </Text>
      </label>
      {input}
    </Stack>
  )
}
export function FormNode<Schema extends SanityDocument>(
  props: FormNodeProps<Schema>,
) {
  return props.path.length === 0 ? (
    <DocumentInput {...props} />
  ) : (
    <FormNode_ {...props} />
  )
}
